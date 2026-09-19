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

const FONTS = [
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
  const [threshold, setThreshold] = useState<number>(128);
  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);
  const [hasMask, setHasMask] = useState<boolean>(false);
  const [isEditingMaskMode, setIsEditingMaskMode] = useState<boolean>(false);

  // レイヤー管理
  const [objectsList, setObjectsList] = useState<fabric.Object[]>([]);
  const [activeObject, setActiveObject] = useState<fabric.Object | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<{ [key: number]: boolean }>({});

  // 履歴（Undo）管理
  const historyRef = useRef<string[]>([]);
  const isRedoingRef = useRef<boolean>(false);

  // ドラッグ＆ドロップ状態
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const guideLinesRef = useRef<fabric.Line[]>([]);
  const currentEditingGroupRef = useRef<any>(null);

  // 状態の保存（Undo用）
  const saveHistory = (canvas: fabric.Canvas) => {
    if (isRedoingRef.current) return;
    const json = JSON.stringify(canvas.toDatalessJSON(['_isMaskGroup', '_maskData', '_maskedImage', '_frameShape', '_originalImg', '_maskOffsetX', '_maskOffsetY']));
    historyRef.current.push(json);
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    }
  };

  // 1つ前に戻す（Undo）
  const undo = () => {
    if (!fabricCanvas || historyRef.current.length <= 1) return;

    if (currentEditingGroupRef.current) {
      exitMaskEditMode();
    }

    isRedoingRef.current = true;
    historyRef.current.pop();
    const prevState = historyRef.current[historyRef.current.length - 1];

    fabricCanvas.loadFromJSON(prevState, () => {
      fabricCanvas.renderAll();
      refreshObjectsList(fabricCanvas);
      isRedoingRef.current = false;
    });
  };

  // レイヤー一覧の同期
  const refreshObjectsList = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects().filter((obj) => obj.type !== 'line');
    setObjectsList([...objs].reverse());
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const size = PAPER_SIZES[selectedSize];
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: paperColor,
    });

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
        if (obj === target || obj.type === 'line') return;

        const objBBox = obj.getBoundingRect();
        const objCenter = obj.getCenterPoint();

        if (Math.abs(targetBBox.left - objBBox.left) < snapThreshold) {
          target.set('left', objBBox.left + (target.left - targetBBox.left));
          drawGuideLine(objBBox.left, 0, objBBox.left, size.height);
        } else if (Math.abs(targetCenter.x - objCenter.x) < snapThreshold) {
          target.setPositionByOrigin(new fabric.Point(objCenter.x, targetCenter.y), 'center', 'center');
          drawGuideLine(objCenter.x, 0, objCenter.x, size.height);
        } else if (Math.abs(targetBBox.left + targetBBox.width - (objBBox.left + objBBox.width)) < snapThreshold) {
          target.set('left', objBBox.left + objBBox.width - targetBBox.width + (target.left - targetBBox.left));
          drawGuideLine(objBBox.left + objBBox.width, 0, objBBox.left + objBBox.width, size.height);
        }

        if (Math.abs(targetBBox.top - objBBox.top) < snapThreshold) {
          target.set('top', objBBox.top + (target.top - targetBBox.top));
          drawGuideLine(0, objBBox.top, size.width, objBBox.top);
        } else if (Math.abs(targetCenter.y - objCenter.y) < snapThreshold) {
          target.setPositionByOrigin(new fabric.Point(targetCenter.x, objCenter.y), 'center', 'center');
          drawGuideLine(0, objCenter.y, size.width, objCenter.y);
        } else if (Math.abs(targetBBox.top + targetBBox.height - (objBBox.top + objBBox.height)) < snapThreshold) {
          target.set('top', objBBox.top + objBBox.height - targetBBox.height + (target.top - targetBBox.top));
          drawGuideLine(0, objBBox.top + objBBox.height, size.width, objBBox.top + objBBox.height);
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

      if (currentEditingGroupRef.current && activeObj !== currentEditingGroupRef.current._maskedImage) {
        exitMaskEditMode();
      }

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
      } else {
        setSelectedObjectType(null);
        setHasMask(false);
      }
      refreshObjectsList(canvas);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => {
      if (currentEditingGroupRef.current) {
        exitMaskEditMode();
      }
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

  // キーボード操作（Undo / 矢印キーで1px・10px微調整）
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

  // マスク内部の直接編集モードに入る
  const enterMaskEditMode = (canvas: fabric.Canvas, group: any) => {
    currentEditingGroupRef.current = group;
    setIsEditingMaskMode(true);

    const imgObj = group._maskedImage;
    const origShape = group._frameShape;

    // グループを分解して画像のみ選択可能にする
    const groupCenter = group.getCenterPoint();
    const offsetX = imgObj._maskOffsetX || 0;
    const offsetY = imgObj._maskOffsetY || 0;

    canvas.remove(group);

    // くり抜き（clipPath）
    const clipPath = createClipPath(origShape, imgObj, offsetX, offsetY);
    imgObj.set({
      clipPath: clipPath,
      left: groupCenter.x + offsetX,
      top: groupCenter.y + offsetY,
      originX: 'center',
      originY: 'center',
    });

    // 枠線をプレビュー描画
    let frameObj: fabric.Object;
    if (origShape.type === 'circle') {
      const radius = origShape.radius * (origShape.scaleX || 1);
      frameObj = new fabric.Circle({
        radius: radius,
        fill: 'transparent',
        stroke: origShape.stroke || '#000',
        strokeWidth: origShape.strokeWidth || 4,
        originX: 'center',
        originY: 'center',
        left: groupCenter.x,
        top: groupCenter.y,
        selectable: false,
        evented: false,
      });
    } else {
      const w = origShape.width * (origShape.scaleX || 1);
      const h = origShape.height * (origShape.scaleY || 1);
      frameObj = new fabric.Rect({
        width: w,
        height: h,
        fill: 'transparent',
        stroke: origShape.stroke || '#000',
        strokeWidth: origShape.strokeWidth || 4,
        originX: 'center',
        originY: 'center',
        left: groupCenter.x,
        top: groupCenter.y,
        selectable: false,
        evented: false,
      });
    }

    (frameObj as any)._isTempFrame = true;

    canvas.add(imgObj);
    canvas.add(frameObj);
    canvas.setActiveObject(imgObj);

    // 画像が移動した際にクリッピング領域を動的に更新
    imgObj.on('moving', () => {
      const currentOffsetX = imgObj.left - groupCenter.x;
      const currentOffsetY = imgObj.top - groupCenter.y;
      imgObj.set('clipPath', createClipPath(origShape, imgObj, currentOffsetX, currentOffsetY));
      canvas.renderAll();
    });

    imgObj.on('scaling', () => {
      const currentOffsetX = imgObj.left - groupCenter.x;
      const currentOffsetY = imgObj.top - groupCenter.y;
      imgObj.set('clipPath', createClipPath(origShape, imgObj, currentOffsetX, currentOffsetY));
      canvas.renderAll();
    });

    canvas.renderAll();
  };

  // 直接編集モードを抜けてグループに復帰
  const exitMaskEditMode = () => {
    if (!fabricCanvas || !currentEditingGroupRef.current) return;

    const group = currentEditingGroupRef.current;
    const imgObj = group._maskedImage;
    const origShape = group._frameShape;

    const tempFrame = fabricCanvas.getObjects().find((o) => (o as any)._isTempFrame);
    if (tempFrame) fabricCanvas.remove(tempFrame);

    const groupCenter = { x: tempFrame ? tempFrame.left : group.left, y: tempFrame ? tempFrame.top : group.top };
    const offsetX = imgObj.left - groupCenter.x;
    const offsetY = imgObj.top - groupCenter.y;

    imgObj.off('moving');
    imgObj.off('scaling');

    fabricCanvas.remove(imgObj);

    createMaskGroup(imgObj, origShape, offsetX, offsetY, groupCenter);

    currentEditingGroupRef.current = null;
    setIsEditingMaskMode(false);
  };

  const createClipPath = (targetShape: fabric.Object, imageObj: any, offsetX: number, offsetY: number) => {
    const scaleX = imageObj.scaleX || 1;
    const scaleY = imageObj.scaleY || 1;

    if (targetShape.type === 'circle') {
      const circle = targetShape as fabric.Circle;
      const radius = circle.radius * (circle.scaleX || 1);

      return new fabric.Circle({
        radius: radius / scaleX,
        originX: 'center',
        originY: 'center',
        left: -offsetX / scaleX,
        top: -offsetY / scaleY,
      });
    } else {
      const rect = targetShape as fabric.Rect;
      const w = rect.width * (rect.scaleX || 1);
      const h = rect.height * (rect.scaleY || 1);

      return new fabric.Rect({
        width: w / scaleX,
        height: h / scaleY,
        originX: 'center',
        originY: 'center',
        left: -offsetX / scaleX,
        top: -offsetY / scaleY,
      });
    }
  };

  // 画像と枠線を一体化（グループ化）
  const createMaskGroup = (imageObj: any, targetShape: fabric.Object, offsetX = 0, offsetY = 0, currentGroupPos?: { x: number; y: number }) => {
    if (!fabricCanvas) return;

    const shapeCenter = currentGroupPos || targetShape.getCenterPoint();
    let clipPath = createClipPath(targetShape, imageObj, offsetX, offsetY);
    let frameObj: fabric.Object;

    if (targetShape.type === 'circle') {
      const circle = targetShape as fabric.Circle;
      const radius = circle.radius * (circle.scaleX || 1);

      frameObj = new fabric.Circle({
        radius: radius,
        fill: 'transparent',
        stroke: circle.stroke,
        strokeWidth: circle.strokeWidth,
        originX: 'center',
        originY: 'center',
      });
    } else {
      const rect = targetShape as fabric.Rect;
      const w = rect.width * (rect.scaleX || 1);
      const h = rect.height * (rect.scaleY || 1);

      frameObj = new fabric.Rect({
        width: w,
        height: h,
        fill: 'transparent',
        stroke: rect.stroke,
        strokeWidth: rect.strokeWidth,
        originX: 'center',
        originY: 'center',
      });
    }

    imageObj.set({
      originX: 'center',
      originY: 'center',
      left: offsetX,
      top: offsetY,
      clipPath: clipPath,
    });

    imageObj._maskOffsetX = offsetX;
    imageObj._maskOffsetY = offsetY;

    const group = new fabric.Group([imageObj, frameObj], {
      left: shapeCenter.x,
      top: shapeCenter.y,
      originX: 'center',
      originY: 'center',
    });

    (group as any)._isMaskGroup = true;
    (group as any)._maskedImage = imageObj;
    (group as any)._frameShape = targetShape;

    fabricCanvas.remove(imageObj);
    fabricCanvas.remove(targetShape);

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();
  };

  // マスク（グループ）解除
  const removeMask = () => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject() as any;
    if (activeObj && activeObj._isMaskGroup) {
      const imgObj = activeObj._maskedImage;
      const shapeObj = activeObj._frameShape;

      imgObj.set({
        clipPath: undefined,
        left: activeObj.left,
        top: activeObj.top,
      });
      delete imgObj._maskOffsetX;
      delete imgObj._maskOffsetY;

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

  const addText = (isTitle: boolean) => {
    if (!fabricCanvas) return;
    const size = isTitle ? 36 : 18;
    const text = new fabric.IText(isTitle ? '見出しタイトル' : 'ここへ本文テキストを入力します。', {
      left: 50,
      top: 50,
      fontFamily: fontFamily,
      fontSize: size,
      fontWeight: isTitle ? 'bold' : 'normal',
      fill: '#000000',
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;
    const sw = parseInt(strokeWidthInput, 10) || 4;
    const rect = new fabric.Rect({
      left: 80,
      top: 120,
      width: 160,
      height: 160,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: sw,
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    const sw = parseInt(strokeWidthInput, 10) || 4;
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 80,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: sw,
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

  const applyMonochromeFilter = (imgElement: HTMLImageElement, threshValue: number) => {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = imgElement.width;
    tempCanvas.height = imgElement.height;

    if (ctx) {
      ctx.drawImage(imgElement, 0, 0);
      const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (avg < threshValue) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
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
        const convertedCanvas = applyMonochromeFilter(imgObj, threshold);
        const fabricImg = new fabric.Image(convertedCanvas, {
          left: 60,
          top: 60,
        });
        (fabricImg as any)._originalImg = imgObj;

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
        const newCanvas = applyMonochromeFilter(targetImg._originalImg, newThresh);
        targetImg.setElement(newCanvas);
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  // ドラッグ＆ドロップ処理（レイヤー並べ替え ＆ 重ね合わせでマスク化）
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
    }

    refreshObjectsList(fabricCanvas);
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    activeObjects.forEach((obj) => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
  };

  const exportForPrint = () => {
    if (!fabricCanvas) return;

    if (currentEditingGroupRef.current) {
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

  const toggleGroupExpand = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups((prev) => ({ ...prev, [index]: !prev[index] }));
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

          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>フォント・文字サイズ</span>
            <select
              value={fontFamily}
              onChange={(e) => updateFontFamily(e.target.value)}
              style={{ width: '100%', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '4px' }}
            >
              {FONTS.map((f) => (
                <option key={f.name} value={f.family}>{f.name}</option>
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
                <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>モノクロ濃淡: {threshold}</span>
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
        <p style={{ fontSize: '11px', color: '#4b5563', margin: 0, lineHeight: '1.4' }}>
          💡 ダブルクリックで枠内位置をダイレクト微調整。
        </p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {objectsList.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>要素がありません</p>
          ) : (
            objectsList.map((obj: any, index) => {
              const isSelected = activeObject === obj;
              const isDragging = draggedIndex === index;
              const isTargeted = dragOverIndex === index;
              const isGroup = !!obj._isMaskGroup;
              const isExpanded = !!expandedGroups[index];

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      {isGroup && (
                        <span
                          onClick={(e) => toggleGroupExpand(index, e)}
                          style={{ cursor: 'pointer', fontSize: '10px', padding: '2px 4px', color: '#6b7280' }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getObjectLabel(obj)}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>☰</span>
                  </div>

                  {/* グループの展開（中身のレイヤー） */}
                  {isGroup && isExpanded && (
                    <div style={{ marginLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #e5e7eb', paddingLeft: '8px' }}>
                      <div
                        onClick={() => {
                          if (fabricCanvas) {
                            enterMaskEditMode(fabricCanvas, obj);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          backgroundColor: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          color: '#374151',
                        }}
                      >
                        🖼 中身の画像（調整）
                      </div>
                      <div
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          backgroundColor: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          color: '#6b7280',
                        }}
                      >
                        🔲 マスク枠
                      </div>
                    </div>
                  )}
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