import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';

// ----------------------------------------------------------------------
// 定数定義
// ----------------------------------------------------------------------
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
  { name: 'オレンジ', hex: '#ff6600', rgb: [255, 102, 0] },
  { name: '濃いピンク', hex: '#e4007f', rgb: [228, 0, 127] },
  { name: 'グリーン', hex: '#009944', rgb: [0, 153, 68] },
];

const DEFAULT_FONTS = [
  { name: 'ゴシック体', family: 'sans-serif' },
  { name: '明朝体', family: 'serif' },
  { name: '丸ゴシック体', family: '"Hiragino Maru Gothic ProN", "HGMaruGothicMPRO", "MotoyaLMaru", sans-serif' },
  { name: '教科書体 / 楷書', family: '"HGKyokashotai", "Yu Mincho", "Kaiti SC", serif' },
  { name: '極太明朝', family: '"HiraMinProN-W6", "YuMincho Bold", serif' },
  { name: '縦長太字', family: 'Impact, "Arial Black", sans-serif' },
  { name: '等幅', family: '"Courier New", Courier, monospace' },
];

export default function App() {
  // ----------------------------------------------------------------------
  // Refs & States
  // ----------------------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  const [selectedSize, setSelectedSize] = useState<keyof typeof PAPER_SIZES>('A4');
  const [paperColor, setPaperColor] = useState<string>('#ff944d');

  const [strokeWidthInput, setStrokeWidthInput] = useState<string>('4');
  const [fontSizeInput, setFontSizeInput] = useState<string>('18');
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [fontList, setFontList] = useState<Array<{ name: string; family: string }>>(DEFAULT_FONTS);
  const [isLoadingFonts, setIsLoadingFonts] = useState<boolean>(false);

  const [threshold, setThreshold] = useState<number>(128);
  const [activeInkColor, setActiveInkColor] = useState<string>('#000000');
  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);
  const [hasMask, setHasMask] = useState<boolean>(false);
  const [isEditingMaskMode, setIsEditingMaskMode] = useState<boolean>(false);

  const [objectsList, setObjectsList] = useState<fabric.Object[]>([]);
  const [activeObject, setActiveObject] = useState<fabric.Object | null>(null);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);

  const historyRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isUndoRedoRef = useRef<boolean>(false);
  const isBatchLoadingRef = useRef<boolean>(false);

  const maskEditingCtxRef = useRef<{
    group: fabric.Group;
    imgObj: fabric.Image;
    frameObj: fabric.Object;
  } | null>(null);

  // ----------------------------------------------------------------------
  // 端末内ローカルフォントの取得
  // ----------------------------------------------------------------------
  const loadLocalFonts = async () => {
    if ('queryLocalFonts' in window) {
      try {
        setIsLoadingFonts(true);
        // @ts-ignore
        const availableFonts = await window.queryLocalFonts();
        const fontMap = new Map<string, string>();

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
        console.warn('ローカルフォント取得エラー:', err);
      } finally {
        setIsLoadingFonts(false);
      }
    } else {
      alert('お使いのブラウザはローカルフォント取得APIに対応していません。');
    }
  };

  // ----------------------------------------------------------------------
  // レイヤーリスト同期
  // ----------------------------------------------------------------------
  const refreshObjectsList = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects().filter((obj) => obj.type !== 'line' && !(obj as any)._isTempFrame);
    setObjectsList([...objs].reverse());
  };

  // ----------------------------------------------------------------------
  // 履歴保存（Undo/Redo）
  // ----------------------------------------------------------------------
  const saveHistory = (canvas: fabric.Canvas) => {
    if (isUndoRedoRef.current || maskEditingCtxRef.current || isBatchLoadingRef.current) return;
    const json = JSON.stringify(
      canvas.toDatalessJSON([
        '_isMaskGroup',
        '_maskedImage',
        '_frameShape',
        '_originalImgSrc',
        '_maskFrameData',
        '_inkColor',
        '_customName',
        '_threshold',
      ])
    );

    if (historyRef.current.length > 0 && historyRef.current[historyRef.current.length - 1] === json) {
      return;
    }

    historyRef.current.push(json);
    redoStackRef.current = [];
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
  };

  const undo = () => {
    if (!fabricCanvas || historyRef.current.length <= 1) return;

    if (maskEditingCtxRef.current) {
      exitMaskEditMode();
    }

    isUndoRedoRef.current = true;
    const current = historyRef.current.pop();
    if (current) redoStackRef.current.push(current);

    const prevState = historyRef.current[historyRef.current.length - 1];

    fabricCanvas.loadFromJSON(prevState, () => {
      fabricCanvas.renderAll();
      refreshObjectsList(fabricCanvas);
      isUndoRedoRef.current = false;
    });
  };

  const redo = () => {
    if (!fabricCanvas || redoStackRef.current.length === 0) return;

    if (maskEditingCtxRef.current) {
      exitMaskEditMode();
    }

    isUndoRedoRef.current = true;
    const nextState = redoStackRef.current.pop();
    if (nextState) {
      historyRef.current.push(nextState);
      fabricCanvas.loadFromJSON(nextState, () => {
        fabricCanvas.renderAll();
        refreshObjectsList(fabricCanvas);
        isUndoRedoRef.current = false;
      });
    }
  };

  // ----------------------------------------------------------------------
  // マスク ClipPath 計算処理
  // ----------------------------------------------------------------------
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

  // ----------------------------------------------------------------------
  // Fabric キャンバス初期化
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;

    const size = PAPER_SIZES[selectedSize];
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: paperColor,
    });

    historyRef.current = [];

    const handleSelection = () => {
      const activeObj = canvas.getActiveObject() as any;
      setActiveObject(activeObj || null);

      if (activeObj) {
        const objs = canvas.getObjects().filter((o) => o.type !== 'line' && !(o as any)._isTempFrame).reverse();
        const idx = objs.indexOf(activeObj);
        setSelectedLayerIndex(idx !== -1 ? idx : null);

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
        if (activeObj._threshold !== undefined) {
          setThreshold(activeObj._threshold);
        }

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
        setSelectedLayerIndex(null);
      }
      refreshObjectsList(canvas);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => {
      setActiveObject(null);
      setSelectedObjectType(null);
      setHasMask(false);
      setSelectedLayerIndex(null);
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
    canvas.on('object:modified', () => saveHistory(canvas));

    setFabricCanvas(canvas);
    saveHistory(canvas);

    return () => {
      canvas.dispose();
    };
  }, [selectedSize]);

  // ----------------------------------------------------------------------
  // 2値化（モノクロ）画像変換処理
  // ----------------------------------------------------------------------
  const applyMonochromeFilter = (imgElement: HTMLImageElement, threshValue: number, colorHex: string) => {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = imgElement.width;
    tempCanvas.height = imgElement.height;

    let r = 0, g = 0, b = 0;
    const matchedInk = INK_COLORS.find((c) => c.hex === colorHex);
    if (matchedInk) {
      [r, g, b] = matchedInk.rgb;
    } else {
      const hexClean = colorHex.replace('#', '');
      if (hexClean.length === 6) {
        r = parseInt(hexClean.substring(0, 2), 16);
        g = parseInt(hexClean.substring(2, 4), 16);
        b = parseInt(hexClean.substring(4, 6), 16);
      }
    }

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

  // ----------------------------------------------------------------------
  // しきい値変更
  // ----------------------------------------------------------------------
  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj) return;

    if (activeObj.type === 'image' && activeObj._originalImgElement) {
      activeObj._threshold = val;
      const newCanvas = applyMonochromeFilter(activeObj._originalImgElement, val, activeObj._inkColor || activeInkColor);
      activeObj.setElement(newCanvas);
      activeObj.dirty = true;
      fabricCanvas.requestRenderAll();
      saveHistory(fabricCanvas);
    } else if (activeObj._isMaskGroup) {
      const groupObjs = activeObj.getObjects();
      const imageObj = groupObjs.find((o: any) => o.type === 'image') || activeObj._maskedImage;
      if (imageObj && imageObj._originalImgElement) {
        imageObj._threshold = val;
        const newCanvas = applyMonochromeFilter(imageObj._originalImgElement, val, imageObj._inkColor || activeInkColor);
        imageObj.setElement(newCanvas);
        imageObj.dirty = true;
        activeObj.dirty = true;
        fabricCanvas.requestRenderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  // ----------------------------------------------------------------------
  // 【修正項目1】マスクグループおよび各種パーツのカラー変更機能
  // ----------------------------------------------------------------------
  const changeInkColor = (hex: string, targetType: 'all' | 'frame' | 'image' = 'all') => {
    setActiveInkColor(hex);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj) return;

    if (activeObj.type === 'i-text') {
      activeObj.set('fill', hex);
      activeObj._inkColor = hex;
    } else if (activeObj.type === 'rect' || activeObj.type === 'circle') {
      activeObj.set('stroke', hex);
      activeObj._inkColor = hex;
    } else if (activeObj.type === 'image') {
      const imgEl = activeObj._originalImgElement;
      if (imgEl) {
        const thresh = activeObj._threshold || threshold;
        const newCanvas = applyMonochromeFilter(imgEl, thresh, hex);
        activeObj.setElement(newCanvas);
        activeObj._inkColor = hex;
      }
    } else if (activeObj._isMaskGroup) {
      const groupObjs = activeObj.getObjects();
      const frameObj = groupObjs.find((o: any) => o.type === 'rect' || o.type === 'circle') || activeObj._frameShape;
      const imageObj = groupObjs.find((o: any) => o.type === 'image') || activeObj._maskedImage;

      // 1. 枠線のカラー変更
      if ((targetType === 'all' || targetType === 'frame') && frameObj) {
        frameObj.set('stroke', hex);
        frameObj._inkColor = hex;
        frameObj.dirty = true;
      }

      // 2. 画像（写真）のカラー変更
      if ((targetType === 'all' || targetType === 'image') && imageObj) {
        const imgEl = imageObj._originalImgElement || (activeObj._maskedImage && activeObj._maskedImage._originalImgElement);
        if (imgEl) {
          const thresh = imageObj._threshold || threshold;
          const newCanvas = applyMonochromeFilter(imgEl, thresh, hex);
          imageObj.setElement(newCanvas);
          imageObj._inkColor = hex;
          imageObj.dirty = true;
        }
      }
      activeObj._inkColor = hex;
      activeObj.dirty = true;
    }

    fabricCanvas.requestRenderAll();
    saveHistory(fabricCanvas);
  };

  // ----------------------------------------------------------------------
  // ストローク・フォント設定変更
  // ----------------------------------------------------------------------
  const updateStrokeWidth = (valStr: string) => {
    setStrokeWidthInput(valStr);
    const val = parseInt(valStr, 10);
    if (isNaN(val) || !fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj) return;

    if (activeObj.type === 'rect' || activeObj.type === 'circle') {
      activeObj.set('strokeWidth', val);
    } else if (activeObj._isMaskGroup) {
      const frameObj = activeObj.getObjects().find((o: any) => o.type !== 'image');
      if (frameObj) {
        frameObj.set('strokeWidth', val);
      }
    }
    fabricCanvas.requestRenderAll();
    saveHistory(fabricCanvas);
  };

  const updateFontSize = (valStr: string) => {
    setFontSizeInput(valStr);
    const val = parseInt(valStr, 10);
    if (isNaN(val) || !fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      (activeObj as fabric.IText).set('fontSize', val);
      fabricCanvas.requestRenderAll();
      saveHistory(fabricCanvas);
    }
  };

  const updateFontFamily = (family: string) => {
    setFontFamily(family);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      (activeObj as fabric.IText).set('fontFamily', family);
      fabricCanvas.requestRenderAll();
      saveHistory(fabricCanvas);
    }
  };

  // ----------------------------------------------------------------------
  // マスクグループ作成・編集
  // ----------------------------------------------------------------------
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

  const enterMaskEditMode = () => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj || !activeObj._isMaskGroup) return;

    const group = activeObj as fabric.Group;
    const groupObjs = group.getObjects();
    const imgObj = groupObjs.find((o: any) => o.type === 'image') as fabric.Image;
    const frameObj = groupObjs.find((o: any) => o.type !== 'image') as fabric.Object;

    if (!imgObj || !frameObj) return;

    maskEditingCtxRef.current = { group, imgObj, frameObj };

    imgObj.set('clipPath', undefined);
    fabricCanvas.remove(group);

    fabricCanvas.add(imgObj);
    fabricCanvas.add(frameObj);

    frameObj.set({
      selectable: false,
      evented: false,
      opacity: 0.6,
    });
    (frameObj as any)._isTempFrame = true;

    fabricCanvas.setActiveObject(imgObj);
    setIsEditingMaskMode(true);
    fabricCanvas.requestRenderAll();
  };

  const exitMaskEditMode = () => {
    if (!fabricCanvas || !maskEditingCtxRef.current) return;

    const { imgObj, frameObj } = maskEditingCtxRef.current;

    frameObj.set({ opacity: 1, selectable: true, evented: true });
    delete (frameObj as any)._isTempFrame;

    fabricCanvas.remove(imgObj);
    fabricCanvas.remove(frameObj);

    createMaskGroup(imgObj, frameObj);

    maskEditingCtxRef.current = null;
    setIsEditingMaskMode(false);
  };

  // ----------------------------------------------------------------------
  // レイヤー操作
  // ----------------------------------------------------------------------
  const moveLayerOrder = (obj: fabric.Object, direction: 'up' | 'down') => {
    if (!fabricCanvas) return;
    if (direction === 'up') fabricCanvas.bringObjectForward(obj);
    if (direction === 'down') fabricCanvas.sendObjectBackwards(obj);
    fabricCanvas.renderAll();
    refreshObjectsList(fabricCanvas);
    saveHistory(fabricCanvas);
  };

  const deleteSelectedObject = () => {
    if (!fabricCanvas) return;
    const activeObjs = fabricCanvas.getActiveObjects();
    if (activeObjs.length > 0) {
      activeObjs.forEach((obj) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      refreshObjectsList(fabricCanvas);
      saveHistory(fabricCanvas);
    }
  };

  const selectLayerObject = (obj: fabric.Object) => {
    if (!fabricCanvas) return;
    fabricCanvas.setActiveObject(obj);
    fabricCanvas.renderAll();
  };

  const renameLayerObject = (obj: any) => {
    const currentName = obj._customName || getObjectLabel(obj);
    const newName = prompt('レイヤーの名前を入力してください:', currentName);
    if (newName !== null && newName.trim() !== '') {
      obj._customName = newName.trim();
      refreshObjectsList(fabricCanvas!);
      saveHistory(fabricCanvas!);
    }
  };

  // ----------------------------------------------------------------------
  // 【修正項目2】JSON読み込み処理（ダイアログ連続表示の撤廃）
  // ----------------------------------------------------------------------
  const loadProjectFromJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        isBatchLoadingRef.current = true;
        const projectData = JSON.parse(event.target?.result as string);

        if (projectData.selectedSize && PAPER_SIZES[projectData.selectedSize as keyof typeof PAPER_SIZES]) {
          setSelectedSize(projectData.selectedSize);
        }

        if (projectData.paperColor) {
          setPaperColor(projectData.paperColor);
        }

        const rawCanvasData = projectData.canvasData || projectData;

        fabricCanvas.loadFromJSON(rawCanvasData, async () => {
          fabricCanvas.backgroundColor = projectData.paperColor || paperColor;

          const allObjs = fabricCanvas.getObjects();
          const processPromises: Promise<void>[] = [];

          allObjs.forEach((obj: any) => {
            if (obj._isMaskGroup) {
              const groupObjs = obj.getObjects();
              const img = groupObjs.find((o: any) => o.type === 'image');
              if (img && img._originalImgSrc) {
                const p = new Promise<void>((resolve) => {
                  const el = new Image();
                  el.src = img._originalImgSrc;
                  el.onload = () => {
                    img._originalImgElement = el;
                    const thresh = img._threshold || 128;
                    const ink = img._inkColor || '#000000';
                    const filteredCanvas = applyMonochromeFilter(el, thresh, ink);
                    img.setElement(filteredCanvas);
                    img.dirty = true;
                    resolve();
                  };
                  el.onerror = () => resolve();
                });
                processPromises.push(p);
              }
            } else if (obj.type === 'image' && obj._originalImgSrc) {
              const p = new Promise<void>((resolve) => {
                const el = new Image();
                el.src = obj._originalImgSrc;
                el.onload = () => {
                  obj._originalImgElement = el;
                  const thresh = obj._threshold || 128;
                  const ink = obj._inkColor || '#000000';
                  const filteredCanvas = applyMonochromeFilter(el, thresh, ink);
                  obj.setElement(filteredCanvas);
                  obj.dirty = true;
                  resolve();
                };
                el.onerror = () => resolve();
              });
              processPromises.push(p);
            }
          });

          await Promise.all(processPromises);

          fabricCanvas.requestRenderAll();
          refreshObjectsList(fabricCanvas);
          isBatchLoadingRef.current = false;
          saveHistory(fabricCanvas);
        });
      } catch (err) {
        console.error('JSON読み込みエラー:', err);
        isBatchLoadingRef.current = false;
        alert('プロジェクトファイルの形式が正しくありません。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ----------------------------------------------------------------------
  // 素材追加処理
  // ----------------------------------------------------------------------
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgSrc = event.target?.result as string;
      const imgObj = new Image();
      imgObj.src = imgSrc;
      imgObj.onload = () => {
        const convertedCanvas = applyMonochromeFilter(imgObj, threshold, activeInkColor);
        const fabricImg = new fabric.Image(convertedCanvas, {
          left: 150,
          top: 150,
          originX: 'center',
          originY: 'center',
        });
        (fabricImg as any)._originalImgElement = imgObj;
        (fabricImg as any)._originalImgSrc = imgSrc;
        (fabricImg as any)._inkColor = activeInkColor;
        (fabricImg as any)._threshold = threshold;

        fabricImg.scaleToWidth(200);
        fabricCanvas.add(fabricImg);
        fabricCanvas.setActiveObject(fabricImg);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addText = (isTitle: boolean) => {
    if (!fabricCanvas) return;
    const text = new fabric.IText(isTitle ? '見出しタイトル' : 'ここへ本文テキストを入力します。', {
      left: 100,
      top: 100,
      fontFamily: fontFamily,
      fontSize: isTitle ? 32 : 18,
      fill: activeInkColor,
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;
    const rect = new fabric.Rect({
      left: 120,
      top: 120,
      width: 160,
      height: 160,
      fill: 'transparent',
      stroke: activeInkColor,
      strokeWidth: parseInt(strokeWidthInput, 10) || 4,
      originX: 'center',
      originY: 'center',
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      radius: 80,
      fill: 'transparent',
      stroke: activeInkColor,
      strokeWidth: parseInt(strokeWidthInput, 10) || 4,
      originX: 'center',
      originY: 'center',
    });
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
  };

  const saveProjectAsJson = () => {
    if (!fabricCanvas) return;
    const jsonCanvasData = fabricCanvas.toDatalessJSON([
      '_isMaskGroup',
      '_maskedImage',
      '_frameShape',
      '_originalImgSrc',
      '_maskFrameData',
      '_inkColor',
      '_customName',
      '_threshold',
    ]);

    const projectData = {
      version: '1.0',
      selectedSize,
      paperColor,
      canvasData: jsonCanvasData,
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flyer_project_${selectedSize}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getObjectLabel = (obj: any) => {
    if (obj._customName) return obj._customName;
    if (obj._isMaskGroup) return 'マスクグループ';
    if (obj.type === 'i-text') return obj.text || 'テキスト';
    if (obj.type === 'rect') return '四角枠';
    if (obj.type === 'circle') return '円枠';
    if (obj.type === 'image') return '画像素材';
    return 'パーツ';
  };

  // ----------------------------------------------------------------------
  // レンダリング (UI構成・CSSスタイルも100%完全そのまま)
  // ----------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* ヘッダー */}
      <div style={{ height: '50px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#111827' }}>レトロチラシ作成ツール</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={saveProjectAsJson} style={{ ...topBtnStyle, backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
            💾 JSON保存
          </button>
          <label style={{ ...topBtnStyle, backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', cursor: 'pointer' }}>
            📂 JSON開く
            <input
              ref={jsonFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={loadProjectFromJson}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左操作パネル */}
        <div style={{ width: '300px', backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', overflowY: 'auto' }}>
          {/* 1. 用紙サイズ */}
          <div>
            <label style={labelStyle}>1. 用紙サイズ</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {Object.keys(PAPER_SIZES).map((sizeKey) => (
                <button
                  key={sizeKey}
                  onClick={() => setSelectedSize(sizeKey as keyof typeof PAPER_SIZES)}
                  style={{
                    ...btnStyle,
                    flex: 1,
                    backgroundColor: selectedSize === sizeKey ? '#000000' : '#ffffff',
                    color: selectedSize === sizeKey ? '#ffffff' : '#374151',
                    textAlign: 'center',
                  }}
                >
                  {PAPER_SIZES[sizeKey as keyof typeof PAPER_SIZES].label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 用紙カラー */}
          <div>
            <label style={labelStyle}>2. 用紙カラー</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PAPER_COLORS.map((pc) => (
                <button
                  key={pc.name}
                  onClick={() => {
                    setPaperColor(pc.color);
                    if (fabricCanvas) {
                      fabricCanvas.backgroundColor = pc.color;
                      fabricCanvas.renderAll();
                      saveHistory(fabricCanvas);
                    }
                  }}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: pc.color,
                    border: paperColor === pc.color ? '3px solid #000' : '1px solid #d1d5db',
                    cursor: 'pointer',
                  }}
                  title={pc.name}
                />
              ))}
            </div>
          </div>

          {/* 3. 素材を追加 */}
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

          {/* 4. 選択中パーツの編集 */}
          <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>4. 選択中パーツの編集</label>

            {hasMask ? (
              <div style={{ backgroundColor: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111827', display: 'block', marginBottom: '8px' }}>
                  🎨 マスクグループの色指定
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>全体に適用</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {INK_COLORS.map((ink) => (
                        <button
                          key={`all_${ink.name}`}
                          onClick={() => changeInkColor(ink.hex, 'all')}
                          style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: ink.hex, border: '1px solid #d1d5db', cursor: 'pointer' }}
                          title={`全体を${ink.name}にする`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>枠（外枠線）のみ変更</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {INK_COLORS.map((ink) => (
                        <button
                          key={`frame_${ink.name}`}
                          onClick={() => changeInkColor(ink.hex, 'frame')}
                          style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: ink.hex, border: '1px solid #d1d5db', cursor: 'pointer' }}
                          title={`枠を${ink.name}にする`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>画像（写真）のみ変更</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {INK_COLORS.map((ink) => (
                        <button
                          key={`img_${ink.name}`}
                          onClick={() => changeInkColor(ink.hex, 'image')}
                          style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: ink.hex, border: '1px solid #d1d5db', cursor: 'pointer' }}
                          title={`写真を${ink.name}にする`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>プリント色</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {INK_COLORS.map((ink) => (
                    <button
                      key={ink.name}
                      onClick={() => changeInkColor(ink.hex, 'all')}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: ink.hex,
                        border: activeInkColor === ink.hex ? '2px solid #000' : '1px solid #d1d5db',
                        cursor: 'pointer',
                      }}
                      title={ink.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 線の太さ */}
            <div style={{ marginTop: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>線の太さ</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  value={strokeWidthInput}
                  onChange={(e) => updateStrokeWidth(e.target.value)}
                  style={{ width: '60px', padding: '4px 6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                />
                <span style={{ fontSize: '11px', color: '#6b7280' }}>px</span>
              </div>
            </div>

            {/* フォント・文字サイズ */}
            {selectedObjectType === 'i-text' && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>フォント・文字サイズ</span>
                  <button onClick={loadLocalFonts} disabled={isLoadingFonts} style={{ fontSize: '10px', border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}>
                    端末のフォントを取得
                  </button>
                </div>
                <select
                  value={fontFamily}
                  onChange={(e) => updateFontFamily(e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', marginBottom: '6px' }}
                >
                  {fontList.map((f, i) => (
                    <option key={i} value={f.family}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    value={fontSizeInput}
                    onChange={(e) => updateFontSize(e.target.value)}
                    style={{ width: '60px', padding: '4px 6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>px</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 中央キャンバスエリア */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto' }}>
          <div style={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #d1d5db', lineHeight: 0 }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* 右レイヤーパネル */}
        <div style={{ width: '280px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#111827' }}>レイヤー一覧</h2>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {objectsList.map((obj: any, index) => {
              const isSelected = selectedLayerIndex === index;
              return (
                <div
                  key={index}
                  onClick={() => selectLayerObject(obj)}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: isSelected ? 'bold' : 'normal', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                      {getObjectLabel(obj)}
                    </span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLayerOrder(obj, 'up');
                        }}
                        style={iconBtnStyle}
                        title="前面へ"
                      >
                        ▲
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLayerOrder(obj, 'down');
                        }}
                        style={iconBtnStyle}
                        title="背面へ"
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  {obj._isMaskGroup && (
                    <div style={{ fontSize: '10px', color: '#6b7280', paddingLeft: '8px', borderLeft: '2px solid #d1d5db' }}>
                      <div>├ 🖼 マスク対象の画像</div>
                      <div>└ 🔲 マスク外枠線</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// スタイル定義
// ----------------------------------------------------------------------
const topBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 'bold',
  borderRadius: '6px',
  border: '1px solid',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#374151',
  marginBottom: '6px',
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

const iconBtnStyle: React.CSSProperties = {
  padding: '2px 4px',
  fontSize: '9px',
  backgroundColor: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: '3px',
  cursor: 'pointer',
};