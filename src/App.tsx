import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';

const PAPER_SIZES = {
  A4: { width: 420, height: 595, label: 'A4' },
  A3: { width: 500, height: 707, label: 'A3' },
  SQUARE: { width: 500, height: 500, label: 'スクエア' },
};

const PAPER_COLORS = [
  { name: 'オレンジ', color: '#ff944d' },
  { name: 'ピンク', color: '#ff99c8' },
  { name: 'グリーン', color: '#80ed99' },
  { name: 'レッド', color: '#ff5964' },
  { name: 'イエロー', color: '#ffee93' },
  { name: 'パープル', color: '#c77dff' },
  { name: 'ブルー', color: '#90e0ef' },
  { name: 'ホワイト', color: '#ffffff' },
];

const INK_COLORS = [
  { name: 'ブラック', hex: '#000000', rgb: [0, 0, 0] },
  { name: 'ブルー', hex: '#0055ff', rgb: [0, 85, 255] },
  { name: 'レッド', hex: '#e60012', rgb: [230, 0, 18] },
  { name: '濃いピンク', hex: '#e4007f', rgb: [228, 0, 127] },
  { name: 'グリーン', hex: '#009944', rgb: [0, 153, 68] },
];

const DEFAULT_FONTS = [
  { name: 'ゴシック体', family: 'sans-serif' },
  { name: '明朝体', family: 'serif' },
  { name: '等幅（レトロ風）', family: 'monospace' },
  { name: 'インパクト（太字）', family: 'Impact, sans-serif' },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  const [selectedSize, setSelectedSize] = useState<keyof typeof PAPER_SIZES>('A4');
  const [paperColor, setPaperColor] = useState<string>('#ff944d');

  // 編集プロパティ状態
  const [strokeWidthInput, setStrokeWidthInput] = useState<string>('4');
  const [fontSizeInput, setFontSizeInput] = useState<string>('32');
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [fontList, setFontList] = useState<Array<{ name: string; family: string }>>(DEFAULT_FONTS);
  const [isLoadingFonts, setIsLoadingFonts] = useState<boolean>(false);

  const [threshold, setThreshold] = useState<number>(128);
  const [activeInkColor, setActiveInkColor] = useState<string>('#000000');
  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);
  const [hasMask, setHasMask] = useState<boolean>(false);
  const [isEditingMaskMode, setIsEditingMaskMode] = useState<boolean>(false);

  // レイヤー管理
  const [objectsList, setObjectsList] = useState<fabric.Object[]>([]);
  const [activeObject, setActiveObject] = useState<fabric.Object | null>(null);

  // 履歴（Undo）管理
  const historyRef = useRef<string[]>([]);
  const isUndoRedoRef = useRef<boolean>(false);

  // ドラッグ＆ドロップ状態
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const guideLinesRef = useRef<fabric.Line[]>([]);
  const maskEditingCtxRef = useRef<{
    group: fabric.Group;
    imgObj: fabric.Image;
    frameObj: fabric.Object;
  } | null>(null);

  // 端末（ローカル）のフォントを取得する関数
  const loadLocalFonts = async () => {
    if ('queryLocalFonts' in window) {
      try {
        setIsLoadingFonts(true);
        // @ts-ignore
        const availableFonts = await window.queryLocalFonts();
        const fontMap = new Map<string, string>();

        // 重複を除外して取得
        availableFonts.forEach((font: any) => {
          if (!fontMap.has(font.family)) {
            fontMap.set(font.family, font.family);
          }
        });

        const localFonts = Array.from(fontMap.keys())
          .sort()
          .map((fam) => ({ name: fam, family: fam }));

        setFontList([...DEFAULT_FONTS, ...localFonts]);
      } catch (err) {
        console.warn('ローカルフォント取得が拒否されたか失敗しました:', err);
        alert('フォントの取得許可が得られなかったか、サポートされていないブラウザです。');
      } finally {
        setIsLoadingFonts(false);
      }
    } else {
      alert('お使いのブラウザ（または環境）はローカルフォント取得機能（Local Fonts API）に対応していません。Chrome / Edge などでお試しください。');
    }
  };

  // レイヤー一覧の同期
  const refreshObjectsList = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects().filter((obj) => obj.type !== 'line' && !(obj as any)._isTempFrame);
    setObjectsList([...objs].reverse());
  };

  // 状態の保存（Undo用）
  const saveHistory = (canvas: fabric.Canvas) => {
    if (isUndoRedoRef.current || maskEditingCtxRef.current) return;
    const json = JSON.stringify(
      canvas.toDatalessJSON([
        '_isMaskGroup',
        '_maskedImage',
        '_frameShape',
        '_originalImg',
        '_maskFrameData',
        '_inkColor',
      ])
    );

    if (historyRef.current.length > 0 && historyRef.current[historyRef.current.length - 1] === json) {
      return;
    }

    historyRef.current.push(json);
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    }
  };

  // 1つ前に戻す（Undo）
  const undo = () => {
    if (!fabricCanvas || historyRef.current.length <= 1) return;

    if (maskEditingCtxRef.current) {
      exitMaskEditMode();
    }

    isUndoRedoRef.current = true;
    historyRef.current.pop();
    const prevState = historyRef.current[historyRef.current.length - 1];

    fabricCanvas.loadFromJSON(prevState, () => {
      fabricCanvas.renderAll();
      refreshObjectsList(fabricCanvas);
      isUndoRedoRef.current = false;
    });
  };

  // 正確な Mask / ClipPath の生成計算
  const updateImageClipPath = (img: fabric.Image, frameData: any) => {
    let clipShape: fabric.Object;

    if (frameData.type === 'circle') {
      clipShape = new fabric.Circle({
        radius: frameData.radius,
        originX: 'center',
        originY: 'center',
      });
    } else {
      clipShape = new fabric.Rect({
        width: frameData.width,
        height: frameData.height,
        originX: 'center',
        originY: 'center',
      });
    }

    const frameMatrix = fabric.util.composeMatrix({
      translateX: frameData.left,
      translateY: frameData.top,
      scaleX: frameData.scaleX || 1,
      scaleY: frameData.scaleY || 1,
      angle: frameData.angle || 0,
      skewX: 0,
      skewY: 0,
    });

    const imgMatrix = img.calcTransformMatrix();
    const invertedImgMatrix = fabric.util.invertTransform(imgMatrix);

    const relativeMatrix = fabric.util.multiplyTransformMatrices(invertedImgMatrix, frameMatrix);
    const options = fabric.util.qrDecompose(relativeMatrix);

    clipShape.set({
      left: options.translateX,
      top: options.translateY,
      scaleX: options.scaleX,
      scaleY: options.scaleY,
      angle: options.angle,
      skewX: options.skewX,
      skewY: options.skewY,
      absolutePositioned: false,
    });

    img.set('clipPath', clipShape);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const size = PAPER_SIZES[selectedSize];
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: paperColor,
    });

    historyRef.current = [];

    const clearGuides = () => {
      guideLinesRef.current.forEach((line) => canvas.remove(line));
      guideLinesRef.current = [];
    };

    const drawGuideLine = (x1: number, y1: number, x2: number, y2: number) => {
      const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: '#ff0000',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        strokeDashArray: [4, 4],
      });
      canvas.add(line);
      guideLinesRef.current.push(line);
    };

    // スマートガイド
    canvas.on('object:moving', (e) => {
      clearGuides();
      const target = e.target;
      if (!target) return;

      const snapThreshold = 6;
      const targetBBox = target.getBoundingRect();
      const targetCenter = target.getCenterPoint();

      if (Math.abs(targetCenter.x - size.width / 2) < snapThreshold) {
        target.setPositionByOrigin(new fabric.Point(size.width / 2, targetCenter.y), 'center', 'center');
        drawGuideLine(size.width / 2, 0, size.width / 2, size.height);
      }
      if (Math.abs(targetCenter.y - size.height / 2) < snapThreshold) {
        target.setPositionByOrigin(new fabric.Point(targetCenter.x, size.height / 2), 'center', 'center');
        drawGuideLine(0, size.height / 2, size.width, size.height / 2);
      }

      canvas.getObjects().forEach((obj) => {
        if (obj === target || obj.type === 'line' || (obj as any)._isTempFrame) return;

        const objBBox = obj.getBoundingRect();
        const objCenter = obj.getCenterPoint();

        if (Math.abs(targetBBox.left - objBBox.left) < snapThreshold) {
          target.set('left', objBBox.left + (target.left - targetBBox.left));
          drawGuideLine(objBBox.left, 0, objBBox.left, size.height);
        } else if (Math.abs(targetCenter.x - objCenter.x) < snapThreshold) {
          target.setPositionByOrigin(new fabric.Point(objCenter.x, targetCenter.y), 'center', 'center');
          drawGuideLine(objCenter.x, 0, objCenter.x, size.height);
        }
      });

      canvas.renderAll();
    });

    canvas.on('object:modified', () => {
      clearGuides();
      saveHistory(canvas);
    });

    // ダブルクリックでキャンバス上でダイレクトマスク微調整モードへ
    canvas.on('mouse:dblclick', (e) => {
      const target = e.target as any;
      if (target && target._isMaskGroup) {
        enterMaskEditMode(canvas, target);
      }
    });

    const handleSelection = () => {
      const activeObj = canvas.getActiveObject() as any;
      setActiveObject(activeObj || null);

      if (activeObj) {
        setSelectedObjectType(activeObj.type);
        setHasMask(!!activeObj._isMaskGroup);
        if (activeObj.strokeWidth !== undefined) {
          setStrokeWidthInput(String(activeObj.strokeWidth));
        }
        if ((activeObj as fabric.IText).fontSize) {
          setFontSizeInput(String((activeObj as fabric.IText).fontSize));
        }
        if ((activeObj as fabric.IText).fontFamily) {
          setFontFamily((activeObj as fabric.IText).fontFamily);
        }

        // カラーの同期
        if (activeObj.fill && typeof activeObj.fill === 'string') {
          setActiveInkColor(activeObj.fill);
        } else if (activeObj.stroke) {
          setActiveInkColor(activeObj.stroke);
        } else if (activeObj._inkColor) {
          setActiveInkColor(activeObj._inkColor);
        }
      } else {
        setSelectedObjectType(null);
        setHasMask(false);
      }
      refreshObjectsList(canvas);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => {
      setActiveObject(null);
      setSelectedObjectType(null);
      setHasMask(false);
      refreshObjectsList(canvas);
    });

    canvas.on('object:added', () => {
      refreshObjectsList(canvas);
      saveHistory(canvas);
    });
    canvas.on('object:removed', () => {
      refreshObjectsList(canvas);
      saveHistory(canvas);
    });

    setFabricCanvas(canvas);
    saveHistory(canvas);

    return () => {
      canvas.dispose();
    };
  }, [selectedSize]);

  // キーボード操作（Undo / 矢印キー微調整）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fabricCanvas) return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      const activeObj = fabricCanvas.getActiveObject();
      if (!activeObj) return;

      const step = e.shiftKey ? 10 : 1;
      let moved = false;

      if (e.key === 'ArrowLeft') {
        activeObj.set('left', (activeObj.left || 0) - step);
        moved = true;
      } else if (e.key === 'ArrowRight') {
        activeObj.set('left', (activeObj.left || 0) + step);
        moved = true;
      } else if (e.key === 'ArrowUp') {
        activeObj.set('top', (activeObj.top || 0) - step);
        moved = true;
      } else if (e.key === 'ArrowDown') {
        activeObj.set('top', (activeObj.top || 0) + step);
        moved = true;
      }

      if (moved) {
        e.preventDefault();
        activeObj.setCoords();
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fabricCanvas]);

  // マスク（画像＋枠線）の生成
  const createMaskGroup = (imageObj: fabric.Image, targetShape: fabric.Object) => {
    if (!fabricCanvas) return;

    const frameData = {
      type: targetShape.type,
      width: targetShape.width * (targetShape.scaleX || 1),
      height: targetShape.height * (targetShape.scaleY || 1),
      radius: (targetShape as fabric.Circle).radius ? (targetShape as fabric.Circle).radius * (targetShape.scaleX || 1) : 0,
      left: targetShape.left,
      top: targetShape.top,
      scaleX: 1,
      scaleY: 1,
      angle: targetShape.angle || 0,
      stroke: targetShape.stroke || activeInkColor,
      strokeWidth: targetShape.strokeWidth || 4,
    };

    updateImageClipPath(imageObj, frameData);

    let outlineObj: fabric.Object;
    if (frameData.type === 'circle') {
      outlineObj = new fabric.Circle({
        radius: frameData.radius,
        fill: 'transparent',
        stroke: frameData.stroke,
        strokeWidth: frameData.strokeWidth,
        left: frameData.left,
        top: frameData.top,
        originX: 'center',
        originY: 'center',
      });
    } else {
      outlineObj = new fabric.Rect({
        width: frameData.width,
        height: frameData.height,
        fill: 'transparent',
        stroke: frameData.stroke,
        strokeWidth: frameData.strokeWidth,
        left: frameData.left,
        top: frameData.top,
        originX: 'center',
        originY: 'center',
      });
    }

    fabricCanvas.remove(imageObj);
    fabricCanvas.remove(targetShape);

    const group = new fabric.Group([imageObj, outlineObj], {
      left: frameData.left,
      top: frameData.top,
      originX: 'center',
      originY: 'center',
    });

    (group as any)._isMaskGroup = true;
    (group as any)._maskedImage = imageObj;
    (group as any)._frameShape = outlineObj;
    (group as any)._maskFrameData = frameData;

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();
    saveHistory(fabricCanvas);
  };

  // マスク内部の直接編集モードに入る
  const enterMaskEditMode = (canvas: fabric.Canvas, group: any) => {
    if (!group._isMaskGroup || maskEditingCtxRef.current) return;

    setIsEditingMaskMode(true);

    const imgObj = group._maskedImage as fabric.Image;
    const frameObj = group._frameShape as fabric.Object;

    canvas.remove(group);

    const frameData = {
      type: frameObj.type,
      width: frameObj.width * (frameObj.scaleX || 1),
      height: frameObj.height * (frameObj.scaleY || 1),
      radius: (frameObj as fabric.Circle).radius ? (frameObj as fabric.Circle).radius * (frameObj.scaleX || 1) : 0,
      left: group.left,
      top: group.top,
      scaleX: 1,
      scaleY: 1,
      angle: group.angle || 0,
      stroke: frameObj.stroke || activeInkColor,
      strokeWidth: frameObj.strokeWidth || 4,
    };

    let guideFrame: fabric.Object;
    if (frameData.type === 'circle') {
      guideFrame = new fabric.Circle({
        radius: frameData.radius,
        fill: 'transparent',
        stroke: frameData.stroke,
        strokeWidth: frameData.strokeWidth,
        left: frameData.left,
        top: frameData.top,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
    } else {
      guideFrame = new fabric.Rect({
        width: frameData.width,
        height: frameData.height,
        fill: 'transparent',
        stroke: frameData.stroke,
        strokeWidth: frameData.strokeWidth,
        left: frameData.left,
        top: frameData.top,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
    }

    (guideFrame as any)._isTempFrame = true;

    updateImageClipPath(imgObj, frameData);

    canvas.add(imgObj);
    canvas.add(guideFrame);
    canvas.setActiveObject(imgObj);

    maskEditingCtxRef.current = {
      group,
      imgObj,
      frameObj: guideFrame,
    };

    const handleTransform = () => {
      updateImageClipPath(imgObj, frameData);
      canvas.renderAll();
    };

    imgObj.on('moving', handleTransform);
    imgObj.on('scaling', handleTransform);
    imgObj.on('rotating', handleTransform);

    canvas.renderAll();
  };

  // 直接編集モードを抜けてグループ化に復帰
  const exitMaskEditMode = () => {
    if (!fabricCanvas || !maskEditingCtxRef.current) return;

    const { imgObj, frameObj } = maskEditingCtxRef.current;

    imgObj.off('moving');
    imgObj.off('scaling');
    imgObj.off('rotating');

    const tempFrame = fabricCanvas.getObjects().find((o) => (o as any)._isTempFrame);
    if (tempFrame) fabricCanvas.remove(tempFrame);

    fabricCanvas.remove(imgObj);

    maskEditingCtxRef.current = null;
    setIsEditingMaskMode(false);

    createMaskGroup(imgObj, frameObj);
  };

  // マスク（グループ）解除
  const removeMask = () => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject() as any;
    if (activeObj && activeObj._isMaskGroup) {
      const imgObj = activeObj._maskedImage;
      const shapeObj = activeObj._frameShape;

      imgObj.set('clipPath', undefined);
      imgObj.set({
        left: activeObj.left,
        top: activeObj.top,
      });

      shapeObj.set({
        left: activeObj.left + 20,
        top: activeObj.top + 20,
      });

      fabricCanvas.remove(activeObj);
      fabricCanvas.add(imgObj);
      fabricCanvas.add(shapeObj);

      fabricCanvas.setActiveObject(imgObj);
      setHasMask(false);
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  const handleColorChange = (color: string) => {
    setPaperColor(color);
    if (fabricCanvas) {
      fabricCanvas.backgroundColor = color;
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  // インク・オブジェクトカラーの変更
  const changeInkColor = (hex: string) => {
    setActiveInkColor(hex);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj) return;

    if (activeObj.type === 'i-text') {
      activeObj.set('fill', hex);
    } else if (activeObj.type === 'rect' || activeObj.type === 'circle') {
      activeObj.set('stroke', hex);
    } else if (activeObj._isMaskGroup) {
      const frame = activeObj.getObjects().find((o: any) => o.type !== 'image');
      if (frame) frame.set('stroke', hex);

      const targetImg = activeObj._maskedImage;
      if (targetImg && targetImg._originalImg) {
        const newCanvas = applyMonochromeFilter(targetImg._originalImg, threshold, hex);
        targetImg.setElement(newCanvas);
        targetImg._inkColor = hex;
      }
    } else if (activeObj.type === 'image' && activeObj._originalImg) {
      const newCanvas = applyMonochromeFilter(activeObj._originalImg, threshold, hex);
      activeObj.setElement(newCanvas);
      activeObj._inkColor = hex;
    }

    fabricCanvas.renderAll();
    saveHistory(fabricCanvas);
  };

  const addText = (isTitle: boolean) => {
    if (!fabricCanvas) return;
    const size = isTitle ? 36 : 18;
    const text = new fabric.IText(isTitle ? '見出しタイトル' : 'ここへ本文テキストを入力します。', {
      left: 50,
      top: 50,
      fontFamily: fontFamily,
      fontSize: size,
      fontWeight: isTitle ? 'bold' : 'normal',
      fill: activeInkColor,
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;
    const sw = parseInt(strokeWidthInput, 10) || 4;
    const rect = new fabric.Rect({
      left: 120,
      top: 120,
      width: 160,
      height: 160,
      fill: 'transparent',
      stroke: activeInkColor,
      strokeWidth: sw,
      originX: 'center',
      originY: 'center',
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    const sw = parseInt(strokeWidthInput, 10) || 4;
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      radius: 80,
      fill: 'transparent',
      stroke: activeInkColor,
      strokeWidth: sw,
      originX: 'center',
      originY: 'center',
    });
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
  };

  const handleStrokeWidthChange = (valStr: string) => {
    setStrokeWidthInput(valStr);
    const num = parseInt(valStr, 10);
    if (!isNaN(num) && num >= 0 && fabricCanvas) {
      const activeObj = fabricCanvas.getActiveObject();
      if (activeObj) {
        if ((activeObj as any)._isMaskGroup) {
          const frame = (activeObj as fabric.Group).getObjects().find((o) => o.type !== 'image');
          if (frame) frame.set('strokeWidth', num);
        } else {
          activeObj.set('strokeWidth', num);
        }
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  const handleFontSizeChange = (valStr: string) => {
    setFontSizeInput(valStr);
    const num = parseInt(valStr, 10);
    if (!isNaN(num) && num > 0 && fabricCanvas) {
      const activeObj = fabricCanvas.getActiveObject();
      if (activeObj && activeObj.type === 'i-text') {
        (activeObj as fabric.IText).set('fontSize', num);
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  const updateFontFamily = (family: string) => {
    setFontFamily(family);
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      (activeObj as fabric.IText).set('fontFamily', family);
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  // 画像の色（インクカラー）フィルター処理
  const applyMonochromeFilter = (imgElement: HTMLImageElement, threshValue: number, colorHex: string) => {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = imgElement.width;
    tempCanvas.height = imgElement.height;

    const matchedInk = INK_COLORS.find((c) => c.hex === colorHex) || INK_COLORS[0];
    const [r, g, b] = matchedInk.rgb;

    if (ctx) {
      ctx.drawImage(imgElement, 0, 0);
      const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (avg < threshValue) {
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        } else {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return tempCanvas;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgObj = new Image();
      imgObj.src = event.target?.result as string;
      imgObj.onload = () => {
        const convertedCanvas = applyMonochromeFilter(imgObj, threshold, activeInkColor);
        const fabricImg = new fabric.Image(convertedCanvas, {
          left: 150,
          top: 150,
          originX: 'center',
          originY: 'center',
        });
        (fabricImg as any)._originalImg = imgObj;
        (fabricImg as any)._inkColor = activeInkColor;

        fabricImg.scaleToWidth(200);
        fabricCanvas.add(fabricImg);
        fabricCanvas.setActiveObject(fabricImg);
      };
    };
    reader.readAsDataURL(file);
  };

  const updateImageThreshold = (newThresh: number) => {
    setThreshold(newThresh);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (activeObj) {
      let targetImg = activeObj;
      if (activeObj._isMaskGroup) {
        targetImg = activeObj._maskedImage;
      }

      if (targetImg && targetImg.type === 'image' && targetImg._originalImg) {
        const color = targetImg._inkColor || activeInkColor;
        const newCanvas = applyMonochromeFilter(targetImg._originalImg, newThresh, color);
        targetImg.setElement(newCanvas);
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  // ドラッグ＆ドロップ処理
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (fromIndex === null || !fabricCanvas || fromIndex === dropIndex) return;

    const draggedObj = objectsList[fromIndex] as any;
    const targetObj = objectsList[dropIndex];

    if (draggedObj.type === 'image' && (targetObj.type === 'rect' || targetObj.type === 'circle')) {
      createMaskGroup(draggedObj, targetObj);
      setHasMask(true);
    } else {
      const currentCanvasObjs = fabricCanvas.getObjects().filter((o) => o.type !== 'line');
      const realFromIdx = currentCanvasObjs.indexOf(draggedObj);
      const realTargetIdx = currentCanvasObjs.indexOf(targetObj);

      if (realFromIdx !== -1 && realTargetIdx !== -1) {
        fabricCanvas.moveObjectTo(draggedObj, realTargetIdx);
      }
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }

    refreshObjectsList(fabricCanvas);
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    activeObjects.forEach((obj) => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    saveHistory(fabricCanvas);
  };

  const exportForPrint = () => {
    if (!fabricCanvas) return;

    if (maskEditingCtxRef.current) {
      exitMaskEditMode();
    }

    const defaultName = `flyer_${selectedSize}`;
    const fileName = prompt('保存するファイル名を入力してください:', defaultName);
    if (!fileName) return;

    guideLinesRef.current.forEach((line) => fabricCanvas.remove(line));

    fabricCanvas.backgroundColor = 'transparent';
    fabricCanvas.renderAll();

    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      multiplier: 3,
    });

    fabricCanvas.backgroundColor = paperColor;
    fabricCanvas.renderAll();

    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = dataUrl;
    link.click();
  };

  const getObjectLabel = (obj: any) => {
    if (obj._isMaskGroup) return '🖼️🔲 マスク画像グループ';
    if (obj.type === 'i-text') {
      const txt = (obj as fabric.IText).text || '';
      return `🔤 ${txt.slice(0, 10)}${txt.length > 10 ? '...' : ''}`;
    }
    if (obj.type === 'rect') return '🔲 四角枠';
    if (obj.type === 'circle') return '⚪ 円枠';
    if (obj.type === 'image') return '🖼 画像';
    return 'パーツ';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* 左操作パネル */}
      <div style={{ width: '320px', backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0', color: '#111827' }}>レトロチラシ作成ツール</h1>

        {/* 用紙サイズ */}
        <div>
          <label style={labelStyle}>1. 用紙サイズ</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(Object.keys(PAPER_SIZES) as Array<keyof typeof PAPER_SIZES>).map((sizeKey) => (
              <button
                key={sizeKey}
                onClick={() => setSelectedSize(sizeKey)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: selectedSize === sizeKey ? '#000000' : '#ffffff',
                  color: selectedSize === sizeKey ? '#ffffff' : '#374151',
                  fontWeight: selectedSize === sizeKey ? 'bold' : 'normal',
                }}
              >
                {PAPER_SIZES[sizeKey].label}
              </button>
            ))}
          </div>
        </div>

        {/* 用紙カラー */}
        <div>
          <label style={labelStyle}>2. 用紙カラー</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {PAPER_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => handleColorChange(c.color)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: paperColor === c.color ? '3px solid #000' : '1px solid #d1d5db',
                  backgroundColor: c.color,
                  cursor: 'pointer',
                }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* 素材追加 */}
        <div>
          <label style={labelStyle}>3. 素材を追加</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => addText(true)} style={{ ...btnStyle, flex: 1 }}>＋ 見出し</button>
              <button onClick={() => addText(false)} style={{ ...btnStyle, flex: 1 }}>＋ 本文</button>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={addRectangle} style={{ ...btnStyle, flex: 1 }}>＋ 四角枠</button>
              <button onClick={addCircle} style={{ ...btnStyle, flex: 1 }}>＋ 円枠</button>
            </div>
            <label style={{ ...btnStyle, textAlign: 'center', cursor: 'pointer' }}>
              📷 画像を追加
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* 編集プロパティ */}
        <div style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <label style={{ ...labelStyle, marginBottom: '6px' }}>4. 選択中パーツの編集</label>

          {/* インクカラー */}
          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>プリント（文字・画像）の色</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {INK_COLORS.map((ink) => (
                <button
                  key={ink.name}
                  onClick={() => changeInkColor(ink.hex)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: ink.hex,
                    border: activeInkColor === ink.hex ? '3px solid #000' : '1px solid #d1d5db',
                    cursor: 'pointer',
                  }}
                  title={ink.name}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>線の太さ</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                inputMode="numeric"
                value={strokeWidthInput}
                onChange={(e) => handleStrokeWidthChange(e.target.value)}
                placeholder="太さ"
                style={{ width: '70px', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>px</span>
            </div>
          </div>

          {/* フォント設定 */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>フォント・文字サイズ</span>
              <button
                onClick={loadLocalFonts}
                disabled={isLoadingFonts}
                style={{ fontSize: '10px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                {isLoadingFonts ? '取得中...' : '🔤 端末のフォントを取得'}
              </button>
            </div>
            <select
              value={fontFamily}
              onChange={(e) => updateFontFamily(e.target.value)}
              style={{ width: '100%', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '4px' }}
            >
              {fontList.map((f, idx) => (
                <option key={`${f.family}_${idx}`} value={f.family}>{f.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                inputMode="numeric"
                value={fontSizeInput}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                placeholder="サイズ"
                style={{ width: '70px', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>px</span>
            </div>
          </div>

          {(selectedObjectType === 'image' || hasMask || isEditingMaskMode) && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>写真の濃淡: {threshold}</span>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={threshold}
                  onChange={(e) => updateImageThreshold(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              {hasMask && !isEditingMaskMode && (
                <>
                  <button
                    onClick={() => {
                      if (fabricCanvas && activeObject) {
                        enterMaskEditMode(fabricCanvas, activeObject);
                      }
                    }}
                    style={{ ...btnStyle, backgroundColor: '#2563eb', color: '#ffffff', border: 'none', textAlign: 'center', fontWeight: 'bold' }}
                  >
                    ✂️ マスクの範囲・位置を微調整
                  </button>
                  <button
                    onClick={removeMask}
                    style={{ ...btnStyle, backgroundColor: '#f3f4f6', color: '#374151', textAlign: 'center' }}
                  >
                    🔓 マスク（グループ）を解除
                  </button>
                </>
              )}

              {isEditingMaskMode && (
                <button
                  onClick={exitMaskEditMode}
                  style={{ ...btnStyle, backgroundColor: '#16a34a', color: '#ffffff', border: 'none', textAlign: 'center', fontWeight: 'bold' }}
                >
                  ✓ 微調整を完了する
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={undo} style={{ ...btnStyle, backgroundColor: '#f3f4f6', color: '#374151', textAlign: 'center' }}>
            ↩ 元に戻す (Undo)
          </button>
          <button onClick={deleteSelected} style={{ ...btnStyle, color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2', textAlign: 'center' }}>
            🗑 選択した要素を削除
          </button>
          <button onClick={exportForPrint} style={{ padding: '10px', backgroundColor: '#000000', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            ⬇ 印刷用データ出力 (PNG)
          </button>
        </div>
      </div>

      {/* キャンバスエリア */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto' }}>
        <div style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #d1d5db', lineHeight: 0 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* 右レイヤーパネル */}
      <div style={{ width: '250px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0', color: '#111827' }}>レイヤー一覧</h2>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {objectsList.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>要素がありません</p>
          ) : (
            objectsList.map((obj: any, index) => {
              const isSelected = activeObject === obj;
              const isDragging = draggedIndex === index;
              const isTargeted = dragOverIndex === index;

              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => {
                      if (fabricCanvas) {
                        fabricCanvas.setActiveObject(obj);
                        fabricCanvas.renderAll();
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '2px dashed',
                      borderColor: isTargeted ? '#2563eb' : isSelected ? '#000000' : '#e5e7eb',
                      backgroundColor: isTargeted ? '#eff6ff' : isSelected ? '#f3f4f6' : '#ffffff',
                      opacity: isDragging ? 0.4 : 1,
                      fontWeight: isSelected ? 'bold' : 'normal',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getObjectLabel(obj)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>☰</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#374151',
  marginBottom: '4px',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: '11px',
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  cursor: 'pointer',
  textAlign: 'left',
};