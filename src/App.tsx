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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  const [selectedSize, setSelectedSize] = useState<keyof typeof PAPER_SIZES>('A4');
  const [paperColor, setPaperColor] = useState<string>('#ff944d');

  // 編集プロパティ
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
  const isBatchLoadingRef = useRef<boolean>(false);

  // ドラッグ＆ドロップ
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const guideLinesRef = useRef<fabric.Line[]>([]);
  const maskEditingCtxRef = useRef<{
    group: fabric.Group;
    imgObj: fabric.Image;
    frameObj: fabric.Object;
  } | null>(null);

  // ローカルフォント取得
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
        console.warn('ローカルフォント取得失敗:', err);
      } finally {
        setIsLoadingFonts(false);
      }
    }
  };

  // レイヤー一覧の同期
  const refreshObjectsList = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects().filter((obj) => obj.type !== 'line' && !(obj as any)._isTempFrame);
    setObjectsList([...objs].reverse());
  };

  // 状態の保存（Undo用）
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
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    }
  };

  // Undo
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

  // Mask計算
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
    canvas.on('object:modified', () => saveHistory(canvas));

    setFabricCanvas(canvas);
    saveHistory(canvas);

    return () => {
      canvas.dispose();
    };
  }, [selectedSize]);

  // モノクロフィルタ生成関数
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

  // ✨ カラー変更処理（グループ内部の画像・枠線を確実に個別更新）
  const changeInkColor = (hex: string, targetType: 'all' | 'frame' | 'image' = 'all') => {
    setActiveInkColor(hex);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj) return;

    // 単体オブジェクトの場合
    if (activeObj.type === 'i-text') {
      activeObj.set('fill', hex);
    } else if (activeObj.type === 'rect' || activeObj.type === 'circle') {
      activeObj.set('stroke', hex);
    } else if (activeObj.type === 'image') {
      const imgEl = activeObj._originalImgElement;
      if (imgEl) {
        const thresh = activeObj._threshold || threshold;
        const newCanvas = applyMonochromeFilter(imgEl, thresh, hex);
        activeObj.setElement(newCanvas);
        activeObj._inkColor = hex;
      }
    } 
    // ✨ マスクグループ（_isMaskGroup）内のカラー適用処理
    else if (activeObj._isMaskGroup) {
      const groupObjs = activeObj.getObjects();
      const frameObj = groupObjs.find((o: any) => o.type !== 'image');
      const imageObj = groupObjs.find((o: any) => o.type === 'image') || activeObj._maskedImage;

      // 枠のカラー更新
      if ((targetType === 'all' || targetType === 'frame') && frameObj) {
        frameObj.set('stroke', hex);
      }

      // 画像のカラー更新
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
      activeObj.dirty = true;
    }

    fabricCanvas.requestRenderAll();
    saveHistory(fabricCanvas);
  };

  // マスクグループの生成
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

  // ✨ JSON読み込み処理（モーダル削除 ＆ 読み込み直後の自動レンダリング適用）
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

        if (projectData.canvasData) {
          fabricCanvas.loadFromJSON(projectData.canvasData, async () => {
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

            // 明示的に再描画・レイヤー同期を呼び出し（モーダル通知なし）
            fabricCanvas.requestRenderAll();
            refreshObjectsList(fabricCanvas);
            isBatchLoadingRef.current = false;
            saveHistory(fabricCanvas);
          });
        }
      } catch (err) {
        console.error('JSON読み込みエラー:', err);
        isBatchLoadingRef.current = false;
        alert('プロジェクトファイルの形式が正しくありません。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
    const text = new fabric.IText(isTitle ? '見出しタイトル' : '本文を入力します', {
      left: 50,
      top: 50,
      fontFamily: fontFamily,
      fontSize: isTitle ? 36 : 18,
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
    const defaultName = `flyer_project_${selectedSize}`;
    const fileName = prompt('保存するプロジェクト名を入力してください:', defaultName);
    if (!fileName) return;

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
    link.download = `${fileName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportForPrint = () => {
    if (!fabricCanvas) return;
    const defaultName = `flyer_${selectedSize}`;
    const fileName = prompt('保存するファイル名を入力してください:', defaultName);
    if (!fileName) return;

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
    if (obj._customName) return obj._customName;
    if (obj._isMaskGroup) return '📦 マスクグループ';
    if (obj.type === 'i-text') return `🔤 ${obj.text?.slice(0, 8) || ''}`;
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

        {/* JSON保存・読み込み */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={saveProjectAsJson} style={{ ...btnStyle, flex: 1, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 'bold', textAlign: 'center' }}>
            💾 JSON保存
          </button>
          <label style={{ ...btnStyle, flex: 1, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 'bold', textAlign: 'center', cursor: 'pointer' }}>
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

        {/* 素材追加 */}
        <div>
          <label style={labelStyle}>素材を追加</label>
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
          <label style={{ ...labelStyle, marginBottom: '6px' }}>選択中パーツの編集</label>

          {/* グループ選択時の個別・全体色指定 */}
          {hasMask ? (
            <div style={{ marginBottom: '10px', backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', display: 'block', marginBottom: '6px' }}>
                🎨 マスクグループのカラー変更
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>全体に適用</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
                  <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>枠（外枠線）のみ変更</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
                  <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>画像（写真）のみ変更</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>プリント（文字・画像）の色</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {INK_COLORS.map((ink) => (
                  <button
                    key={ink.name}
                    onClick={() => changeInkColor(ink.hex, 'all')}
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
          )}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={undo} style={{ ...btnStyle, backgroundColor: '#f3f4f6', color: '#374151', textAlign: 'center' }}>
            ↩ 元に戻す (Undo)
          </button>
          <button onClick={exportForPrint} style={{ padding: '10px', backgroundColor: '#000000', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            ⬇ 印刷用データ出力 (PNG)
          </button>
        </div>
      </div>

      {/* キャンバスエリア */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto' }}>
        <div style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #d1d5db', lineHeight: 0 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* 右レイヤーパネル */}
      <div style={{ width: '280px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0', color: '#111827' }}>レイヤー一覧</h2>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {objectsList.map((obj: any, index) => (
            <div key={index} style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              {getObjectLabel(obj)}
            </div>
          ))}
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