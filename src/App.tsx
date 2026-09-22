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
  { name: 'ホワイト', hex: '#ffffff', rgb: [255, 255, 255] },
  { name: 'ブルー', hex: '#0055ff', rgb: [0, 85, 255] },
  { name: 'レッド', hex: '#e60012', rgb: [230, 0, 18] },
  { name: 'オレンジ', hex: '#ff6600', rgb: [255, 102, 0] },
  { name: '濃いピンク', hex: '#e4007f', rgb: [228, 0, 127] },
  { name: 'グリーン', hex: '#009944', rgb: [0, 153, 68] },
];

const DEFAULT_FONTS = [
  { name: 'ゴシック体', family: 'sans-serif' },
  { name: '明朝体', family: 'serif' },
  { name: '丸ゴシック体（レトロ・親しみ）', family: '"Hiragino Maru Gothic ProN", "HGMaruGothicMPRO", "MotoyaLMaru", "Arial Rounded MT Bold", sans-serif' },
  { name: '教科書体 / 楷書（レトロ・教育）', family: '"HGKyokashotai", "Yu Mincho", "Kaiti SC", "DFKai-SB", cursive, serif' },
  { name: '極太明朝（重厚見出し）', family: '"HiraMinProN-W6", "YuMincho Bold", "MS Mincho", serif' },
  { name: '縦長太字（昭和ポスター風）', family: 'Impact, "Arial Black", "Oswald", sans-serif' },
  { name: '等幅（レトロワープロ風）', family: '"Courier New", Courier, "MS Gothic", monospace' },
  { name: '手書き・ポップ風', family: 'fantasy, "Comic Sans MS", "Chalkboard SE", sans-serif' },
  { name: 'クラシック見出し（欧文風）', family: '"Times New Roman", Times, "Georgia", serif' },
];

const STAMP_PRESETS = [
  { id: 'star_badge', label: '★ SALEバッジ', type: 'shape', path: 'star' },
  { id: 'ribbon_border', label: '〓 ギザギザ罫線', type: 'shape', path: 'zigzag' },
  { id: 'stamp_frame', label: '🈹 割印フレーム', type: 'shape', path: 'stamp' },
  { id: 'retro_arrow', label: '➔ レトロ矢印', type: 'shape', path: 'arrow' },
];

const RETRO_TEXT_STYLES = [
  { label: '切り抜きパンク文字 (A)', text: 'A', bg: '#000000', color: '#ffffff', font: 'Impact', skew: -8 },
  { label: '切り抜きビンテージ (B)', text: 'B', bg: '#e60012', color: '#ffffff', font: 'Georgia', skew: 5 },
  { label: '新聞コラージュ (C)', text: 'C', bg: '#ffee93', color: '#000000', font: 'Courier New', skew: -3 },
  { label: 'ネオンポップ (LIVE)', text: 'LIVE', bg: '#e4007f', color: '#ffffff', font: 'Impact', skew: 6 },
  { label: 'ギグポスター風 (ROCK)', text: 'ROCK', bg: '#000000', color: '#ff944d', font: 'Arial Black', skew: -10 },
];

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#374151',
  marginBottom: '4px',
  display: 'block',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '12px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#374151',
  cursor: 'pointer',
};

const layerOrderBtnStyle: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: '10px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#334155',
  cursor: 'pointer',
  textAlign: 'center',
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  const [selectedSize, setSelectedSize] = useState<keyof typeof PAPER_SIZES>('A4');
  const [paperColor, setPaperColor] = useState<string>('#ff944d');

  const [strokeWidthInput, setStrokeWidthInput] = useState<string>('4');
  const [fontSizeInput, setFontSizeInput] = useState<string>('16');
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [fontList, setFontList] = useState<Array<{ name: string; family: string }>>(DEFAULT_FONTS);
  const [isLoadingFonts, setIsLoadingFonts] = useState<boolean>(false);

  const [charSpacing, setCharSpacing] = useState<number>(0);
  const [lineHeight, setLineHeight] = useState<number>(1.16);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [writingMode, setWritingMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [textStrokeColor, setTextStrokeColor] = useState<string>('#000000');
  const [textStrokeWidth, setTextStrokeWidth] = useState<number>(0);

  const [shapeFillColor, setShapeFillColor] = useState<string>('transparent');

  const [skewX, setSkewX] = useState<number>(0);
  const [skewY, setSkewY] = useState<number>(0);

  const [halftoneEnabled, setHalftoneEnabled] = useState<boolean>(false);
  const [halftoneDotSize, setHalftoneDotSize] = useState<number>(6);
  const [halftoneShape, setHalftoneShape] = useState<'dot' | 'line'>('dot');

  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [enableSnap, setEnableSnap] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(20);

  const [threshold, setThreshold] = useState<number>(128);
  const [activeInkColor, setActiveInkColor] = useState<string>('#000000');
  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);
  const [hasMask, setHasMask] = useState<boolean>(false);
  const [isEditingMaskMode, setIsEditingMaskMode] = useState<boolean>(false);

  const [objectsList, setObjectsList] = useState<fabric.Object[]>([]);
  const [activeObject, setActiveObject] = useState<fabric.Object | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

  const [marginGuides, setMarginGuides] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null);

  const historyRef = useRef<string[]>([]);
  const isUndoRedoRef = useRef<boolean>(false);
  const isBatchLoadingRef = useRef<boolean>(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const guideLinesRef = useRef<fabric.Object[]>([]);
  const gridLinesRef = useRef<fabric.Line[]>([]);
  const maskEditingCtxRef = useRef<{
    group: fabric.Group;
    imgObj: fabric.Image;
    frameObj: fabric.Object;
  } | null>(null);

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
        console.warn('ローカルフォント取得が拒否されたか失敗しました:', err);
        alert('フォントの取得許可が得られなかったか、サポートされていないブラウザです。');
      } finally {
        setIsLoadingFonts(false);
      }
    } else {
      alert('お使いのブラウザはローカルフォント取得機能に対応していません。Chrome / Edge などでお試しください。');
    }
  };

  const refreshObjectsList = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects().filter((obj) => !(obj as any)._isGuideLine && !(obj as any)._isGridLine && !(obj as any)._isTempFrame);
    setObjectsList([...objs].reverse());
  };

  const saveHistory = (canvas: fabric.Canvas) => {
    if (isUndoRedoRef.current || maskEditingCtxRef.current || isBatchLoadingRef.current) return;
    const json = JSON.stringify(
      canvas.toDatalessJSON([
        '_isMaskGroup',
        '_isGeneralGroup',
        '_maskedImage',
        '_frameShape',
        '_originalImgSrc',
        '_maskFrameData',
        '_inkColor',
        '_customName',
        '_threshold',
        '_halftoneDotSize',
        '_halftoneShape',
        '_isGuideLine',
        '_isGridLine',
        'visible',
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
      drawGrid(fabricCanvas);
      isUndoRedoRef.current = false;
    });
  };

  const drawGrid = (canvas: fabric.Canvas) => {
    gridLinesRef.current.forEach((line) => canvas.remove(line));
    gridLinesRef.current = [];

    if (!showGrid) {
      canvas.renderAll();
      return;
    }

    const size = PAPER_SIZES[selectedSize];
    const width = size.width;
    const height = size.height;

    for (let x = gridSize; x < width; x += gridSize) {
      const line = new fabric.Line([x, 0, x, height], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      (line as any)._isGridLine = true;
      canvas.add(line);
      canvas.sendObjectToBack(line);
      gridLinesRef.current.push(line);
    }

    for (let y = gridSize; y < height; y += gridSize) {
      const line = new fabric.Line([0, y, width, y], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      (line as any)._isGridLine = true;
      canvas.add(line);
      canvas.sendObjectToBack(line);
      gridLinesRef.current.push(line);
    }
    canvas.renderAll();
  };

  useEffect(() => {
    if (fabricCanvas) {
      drawGrid(fabricCanvas);
    }
  }, [showGrid, gridSize]);

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
      guideLinesRef.current.forEach((obj) => canvas.remove(obj));
      guideLinesRef.current = [];
      setMarginGuides(null);
    };

    const drawGuideLine = (x1: number, y1: number, x2: number, y2: number) => {
      const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: '#ff0000',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        strokeDashArray: [4, 4],
      });
      (line as any)._isGuideLine = true;
      canvas.add(line);
      guideLinesRef.current.push(line);
    };

    const drawTextLabel = (x: number, y: number, textStr: string) => {
      const txt = new fabric.Text(textStr, {
        left: x,
        top: y,
        fontSize: 10,
        fill: '#ffffff',
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
        padding: 2,
      });
      (txt as any)._isGuideLine = true;
      canvas.add(txt);
      guideLinesRef.current.push(txt);
    };

    let animFrameId: number | null = null;
    const handleObjectMovingOrScaling = (e: fabric.IEvent) => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(() => {
        clearGuides();
        const target = e.target;
        if (!target) return;

        const snapThreshold = 6;
        let targetLeft = target.left || 0;
        let targetTop = target.top || 0;

        const targetBBox = target.getBoundingRect();
        const targetCenter = target.getCenterPoint();

        const marginTop = Math.round(targetBBox.top);
        const marginBottom = Math.round(size.height - (targetBBox.top + targetBBox.height));
        const marginLeft = Math.round(targetBBox.left);
        const marginRight = Math.round(size.width - (targetBBox.left + targetBBox.width));

        setMarginGuides({
          top: marginTop,
          bottom: marginBottom,
          left: marginLeft,
          right: marginRight,
        });

        if (Math.abs(marginTop - marginBottom) < 2) {
          drawGuideLine(0, size.height / 2, size.width, size.height / 2);
        }
        if (Math.abs(marginLeft - marginRight) < 2) {
          drawGuideLine(size.width / 2, 0, size.width / 2, size.height);
        }

        drawGuideLine(targetCenter.x, 0, targetCenter.x, targetBBox.top);
        drawTextLabel(targetCenter.x, targetBBox.top / 2, `${marginTop}px`);

        drawGuideLine(targetCenter.x, targetBBox.top + targetBBox.height, targetCenter.x, size.height);
        drawTextLabel(targetCenter.x, targetBBox.top + targetBBox.height + marginBottom / 2, `${marginBottom}px`);

        drawGuideLine(0, targetCenter.y, targetBBox.left, targetCenter.y);
        drawTextLabel(targetBBox.left / 2, targetCenter.y, `${marginLeft}px`);

        drawGuideLine(targetBBox.left + targetBBox.width, targetCenter.y, size.width, targetCenter.y);
        drawTextLabel(targetBBox.left + targetBBox.width + marginRight / 2, targetCenter.y, `${marginRight}px`);

        if (enableSnap) {
          if (showGrid) {
            const snappedLeft = Math.round(targetLeft / gridSize) * gridSize;
            const snappedTop = Math.round(targetTop / gridSize) * gridSize;

            if (Math.abs(targetLeft - snappedLeft) < snapThreshold) {
              target.set('left', snappedLeft);
            }
            if (Math.abs(targetTop - snappedTop) < snapThreshold) {
              target.set('top', snappedTop);
            }
          }

          if (Math.abs(targetCenter.x - size.width / 2) < snapThreshold) {
            target.setPositionByOrigin(new fabric.Point(size.width / 2, targetCenter.y), 'center', 'center');
            drawGuideLine(size.width / 2, 0, size.width / 2, size.height);
          }
          if (Math.abs(targetCenter.y - size.height / 2) < snapThreshold) {
            target.setPositionByOrigin(new fabric.Point(targetCenter.x, size.height / 2), 'center', 'center');
            drawGuideLine(0, size.height / 2, size.width, size.height / 2);
          }

          canvas.getObjects().forEach((obj) => {
            if (obj === target || (obj as any)._isGuideLine || (obj as any)._isGridLine || (obj as any)._isTempFrame) return;

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
        }

        canvas.renderAll();
      });
    };

    canvas.on('object:moving', handleObjectMovingOrScaling);
    canvas.on('object:scaling', handleObjectMovingOrScaling);

    canvas.on('object:modified', () => {
      clearGuides();
      saveHistory(canvas);
    });

    canvas.on('mouse:down', (e) => {
      if (!e.target) {
        canvas.discardActiveObject();
        canvas.renderAll();
        clearGuides();
      }
    });

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
        setSkewX(activeObj.skewX || 0);
        setSkewY(activeObj.skewY || 0);

        if (activeObj._inkColor) {
          setActiveInkColor(activeObj._inkColor);
        } else if (activeObj.fill && typeof activeObj.fill === 'string' && activeObj.fill !== 'transparent' && activeObj.type !== 'rect' && activeObj.type !== 'circle') {
          setActiveInkColor(activeObj.fill);
        } else if (activeObj.stroke && typeof activeObj.stroke === 'string') {
          setActiveInkColor(activeObj.stroke);
        }

        if (activeObj._isMaskGroup) {
          const groupObjs = activeObj.getObjects ? activeObj.getObjects() : [];
          const targetImg = groupObjs.find((o: any) => o.type === 'image') || activeObj._maskedImage;
          if (targetImg) {
            setThreshold(targetImg._threshold !== undefined ? targetImg._threshold : 128);
            setHalftoneEnabled(!!(targetImg._halftoneDotSize && targetImg._halftoneDotSize > 1));
            setHalftoneDotSize(targetImg._halftoneDotSize || 6);
            setHalftoneShape(targetImg._halftoneShape || 'dot');
            if (targetImg._inkColor) setActiveInkColor(targetImg._inkColor);
          }
        } else if (activeObj.type === 'image') {
          setThreshold(activeObj._threshold !== undefined ? activeObj._threshold : 128);
          setHalftoneEnabled(!!(activeObj._halftoneDotSize && activeObj._halftoneDotSize > 1));
          setHalftoneDotSize(activeObj._halftoneDotSize || 6);
          setHalftoneShape(activeObj._halftoneShape || 'dot');
        }

        if (activeObj.strokeWidth !== undefined) {
          setStrokeWidthInput(String(activeObj.strokeWidth));
        }
        if ((activeObj as fabric.IText).fontSize) {
          setFontSizeInput(String((activeObj as fabric.IText).fontSize));
        }
        if ((activeObj as fabric.IText).fontFamily) {
          setFontFamily((activeObj as fabric.IText).fontFamily);
        }

        if (activeObj.type === 'i-text' || activeObj.type === 'textbox') {
          const txtObj = activeObj as fabric.IText;
          setCharSpacing(txtObj.charSpacing || 0);
          setLineHeight(txtObj.lineHeight || 1.16);
          setTextAlign((txtObj.textAlign as 'left' | 'center' | 'right') || 'left');
          setWritingMode((txtObj as any).splitByGrapheme ? 'vertical' : 'horizontal');
          setTextStrokeColor((txtObj.stroke as string) || '#000000');
          setTextStrokeWidth(txtObj.strokeWidth || 0);
        }

        if (activeObj.type === 'rect' || activeObj.type === 'circle' || activeObj.type === 'path') {
          setShapeFillColor((activeObj.fill as string) || 'transparent');
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
      clearGuides();
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
    drawGrid(canvas);
    saveHistory(canvas);

    return () => {
      canvas.dispose();
    };
  }, [selectedSize]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fabricCanvas) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA')
      ) {
        return;
      }

      const activeObj = fabricCanvas.getActiveObject();
      if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox') && (activeObj as fabric.IText).isEditing) {
        if (e.key === 'Enter' && e.shiftKey) {
          e.stopPropagation();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }

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

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [fabricCanvas]);

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
    (group as any)._inkColor = activeInkColor;

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();
    saveHistory(fabricCanvas);
  };

  const createGroupFromObjects = (obj1: fabric.Object, obj2: fabric.Object) => {
    if (!fabricCanvas) return;
    const group = new fabric.Group([obj1, obj2]);
    (group as any)._isGeneralGroup = true;
    fabricCanvas.remove(obj1);
    fabricCanvas.remove(obj2);
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();
    refreshObjectsList(fabricCanvas);
    saveHistory(fabricCanvas);
  };

  const ungroupGeneralGroup = () => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj) return;

    if (activeObj._isMaskGroup) {
      removeMask();
      return;
    }

    if (activeObj.type === 'group' || activeObj._isGeneralGroup) {
      const items = activeObj.removeAll ? activeObj.removeAll() : activeObj.getObjects();
      fabricCanvas.remove(activeObj);
      items.forEach((item: fabric.Object) => {
        item.set({
          left: (activeObj.left || 0) + (item.left || 0),
          top: (activeObj.top || 0) + (item.top || 0),
        });
        item.setCoords();
        fabricCanvas.add(item);
      });
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      refreshObjectsList(fabricCanvas);
      saveHistory(fabricCanvas);
    }
  };

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

    maskEditingCtxRef.current = { group, imgObj, frameObj: guideFrame };

    const handleTransform = () => {
      updateImageClipPath(imgObj, frameData);
      canvas.renderAll();
    };

    imgObj.on('moving', handleTransform);
    imgObj.on('scaling', handleTransform);
    imgObj.on('rotating', handleTransform);

    canvas.renderAll();
  };

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

  const changeInkColor = (hex: string, targetType: 'all' | 'frame' | 'image' = 'all') => {
    setActiveInkColor(hex);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (!activeObj) return;

    const applyColorToSingleObj = (target: any) => {
      target._inkColor = hex;
      if (target.type === 'i-text' || target.type === 'textbox') {
        target.set('fill', hex);
      } else if (target.type === 'rect' || target.type === 'circle' || target.type === 'path') {
        if (target.stroke) target.set('stroke', hex);
        if (target.fill && target.fill !== 'transparent') target.set('fill', hex);
      } else if (target.type === 'image') {
        if (target._originalImgElement) {
          const thresh = target._threshold !== undefined ? target._threshold : threshold;
          const newCanvas = applyMonochromeFilter(
            target._originalImgElement,
            thresh,
            hex,
            target._halftoneDotSize !== undefined ? target._halftoneDotSize : (halftoneEnabled ? halftoneDotSize : 0),
            target._halftoneShape || halftoneShape
          );
          target.setElement(newCanvas);
        }
      }
    };

    activeObj._inkColor = hex;

    if (activeObj.type === 'group' || activeObj._isGeneralGroup) {
      const children = activeObj.getObjects ? activeObj.getObjects() : [];
      children.forEach((child: any) => applyColorToSingleObj(child));
    } else if (activeObj._isMaskGroup) {
      const groupObjs = activeObj.getObjects ? activeObj.getObjects() : [];
      const frame = groupObjs.find((o: any) => o.type !== 'image') || activeObj._frameShape;
      const targetImg = groupObjs.find((o: any) => o.type === 'image') || activeObj._maskedImage;

      if ((targetType === 'all' || targetType === 'frame') && frame) {
        frame.set('stroke', hex);
      }

      if ((targetType === 'all' || targetType === 'image') && targetImg) {
        applyColorToSingleObj(targetImg);
      }
    } else {
      applyColorToSingleObj(activeObj);
    }

    fabricCanvas.renderAll();
    saveHistory(fabricCanvas);
  };

  const changeShapeFillColor = (color: string) => {
    setShapeFillColor(color);
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && (activeObj.type === 'rect' || activeObj.type === 'circle' || activeObj.type === 'path')) {
      activeObj.set('fill', color);
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  const handleSkewChange = (axis: 'x' | 'y', val: number) => {
    if (axis === 'x') setSkewX(val);
    if (axis === 'y') setSkewY(val);

    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj) {
      if (axis === 'x') activeObj.set('skewX', val);
      if (axis === 'y') activeObj.set('skewY', val);
      activeObj.setCoords();
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  const addText = (type: 'title' | 'body' | 'paragraph') => {
    if (!fabricCanvas) return;
    const size = type === 'title' ? 32 : 16;

    if (type === 'paragraph') {
      const textbox = new fabric.Textbox('ここに本文の段落テキストを入力します。長文の文章も自動で折り返されて段落ブロックとして編集できます。', {
        left: 50,
        top: 50,
        width: 200,
        fontFamily: fontFamily,
        fontSize: 16,
        fill: activeInkColor,
        charSpacing: charSpacing,
        lineHeight: 1.5,
        textAlign: textAlign,
        splitByGrapheme: writingMode === 'vertical',
        stroke: textStrokeWidth > 0 ? textStrokeColor : undefined,
        strokeWidth: textStrokeWidth,
      });
      (textbox as any)._inkColor = activeInkColor;
      fabricCanvas.add(textbox);
      fabricCanvas.setActiveObject(textbox);
    } else {
      const text = new fabric.IText(type === 'title' ? '見出しタイトル' : 'ここへ本文テキストを入力します。', {
        left: 50,
        top: 50,
        fontFamily: fontFamily,
        fontSize: size,
        fontWeight: type === 'title' ? 'bold' : 'normal',
        fill: activeInkColor,
        charSpacing: charSpacing,
        lineHeight: lineHeight,
        textAlign: textAlign,
        splitByGrapheme: writingMode === 'vertical',
        stroke: textStrokeWidth > 0 ? textStrokeColor : undefined,
        strokeWidth: textStrokeWidth,
      });
      (text as any)._inkColor = activeInkColor;
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
    }
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;
    const sw = parseInt(strokeWidthInput, 10) || 4;
    const rect = new fabric.Rect({
      left: 120,
      top: 120,
      width: 160,
      height: 160,
      fill: shapeFillColor,
      stroke: activeInkColor,
      strokeWidth: sw,
      originX: 'center',
      originY: 'center',
    });
    (rect as any)._inkColor = activeInkColor;
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
      fill: shapeFillColor,
      stroke: activeInkColor,
      strokeWidth: sw,
      originX: 'center',
      originY: 'center',
    });
    (circle as any)._inkColor = activeInkColor;
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
  };

  const addStampPreset = (presetId: string) => {
    if (!fabricCanvas) return;

    if (presetId === 'star_badge') {
      const star = new fabric.Path('M 100 0 L 125 75 L 200 75 L 135 115 L 160 190 L 100 145 L 40 190 L 65 115 L 0 75 L 75 75 Z', {
        left: 150,
        top: 150,
        fill: activeInkColor,
        stroke: '#000000',
        strokeWidth: 2,
        scaleX: 0.8,
        scaleY: 0.8,
        originX: 'center',
        originY: 'center',
      });
      (star as any)._inkColor = activeInkColor;
      fabricCanvas.add(star);
      fabricCanvas.setActiveObject(star);
    } else if (presetId === 'ribbon_border') {
      const pathStr = 'M 0 0 L 20 20 L 40 0 L 60 20 L 80 0 L 100 20 L 120 0 L 140 20 L 160 0 L 180 20 L 200 0';
      const line = new fabric.Path(pathStr, {
        left: 150,
        top: 150,
        fill: 'transparent',
        stroke: activeInkColor,
        strokeWidth: 4,
        originX: 'center',
        originY: 'center',
      });
      (line as any)._inkColor = activeInkColor;
      fabricCanvas.add(line);
      fabricCanvas.setActiveObject(line);
    } else if (presetId === 'stamp_frame') {
      const circle = new fabric.Circle({
        left: 150,
        top: 150,
        radius: 60,
        fill: 'transparent',
        stroke: activeInkColor,
        strokeWidth: 6,
        strokeDashArray: [12, 6],
        originX: 'center',
        originY: 'center',
      });
      (circle as any)._inkColor = activeInkColor;
      fabricCanvas.add(circle);
      fabricCanvas.setActiveObject(circle);
    } else if (presetId === 'retro_arrow') {
      const arrow = new fabric.Path('M 0 20 L 120 20 L 120 0 L 180 35 L 120 70 L 120 50 L 0 50 Z', {
        left: 150,
        top: 150,
        fill: activeInkColor,
        originX: 'center',
        originY: 'center',
      });
      (arrow as any)._inkColor = activeInkColor;
      fabricCanvas.add(arrow);
      fabricCanvas.setActiveObject(arrow);
    }
  };

  const addRetroTextStyle = (style: typeof RETRO_TEXT_STYLES[0]) => {
    if (!fabricCanvas) return;

    const bgRect = new fabric.Rect({
      width: 70,
      height: 80,
      fill: style.bg,
      originX: 'center',
      originY: 'center',
      rx: 4,
      ry: 4,
    });

    const txt = new fabric.IText(style.text, {
      fontFamily: style.font,
      fontSize: 48,
      fontWeight: 'bold',
      fill: style.color,
      originX: 'center',
      originY: 'center',
    });

    const letterGroup = new fabric.Group([bgRect, txt], {
      left: 150,
      top: 150,
      skewX: style.skew,
      originX: 'center',
      originY: 'center',
    });

    (letterGroup as any)._isGeneralGroup = true;
    fabricCanvas.add(letterGroup);
    fabricCanvas.setActiveObject(letterGroup);
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
      if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
        (activeObj as fabric.IText).set('fontSize', num);
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  const updateTextProp = (key: string, val: any) => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
      activeObj.set(key as any, val);
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  const toggleWritingMode = (mode: 'horizontal' | 'vertical') => {
    setWritingMode(mode);
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject() as any;
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
      if (mode === 'vertical') {
        activeObj.set({
          splitByGrapheme: true,
        });
      } else {
        activeObj.set({
          splitByGrapheme: false,
        });
      }
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  const updateFontFamily = (family: string) => {
    setFontFamily(family);
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
      (activeObj as fabric.IText).set('fontFamily', family);
      fabricCanvas.renderAll();
      saveHistory(fabricCanvas);
    }
  };

  const applyMonochromeFilter = (
    imgElement: HTMLImageElement,
    threshValue: number,
    colorHex: string,
    dotSize: number = 0,
    shapeMode: 'dot' | 'line' = 'dot'
  ) => {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = imgElement.width;
    tempCanvas.height = imgElement.height;

    let r = 0, g = 0, b = 0;
    if (colorHex && colorHex.startsWith('#')) {
      const hex = colorHex.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    }

    if (ctx) {
      ctx.drawImage(imgElement, 0, 0);
      const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imgData.data;

      if (!dotSize || dotSize <= 1) {
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
      } else {
        ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

        for (let y = 0; y < tempCanvas.height; y += dotSize) {
          for (let x = 0; x < tempCanvas.width; x += dotSize) {
            let totalBrightness = 0;
            let count = 0;

            for (let dy = 0; dy < dotSize && y + dy < tempCanvas.height; dy++) {
              for (let dx = 0; dx < dotSize && x + dx < tempCanvas.width; dx++) {
                const idx = ((y + dy) * tempCanvas.width + (x + dx)) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                totalBrightness += brightness;
                count++;
              }
            }

            const avgBrightness = count > 0 ? totalBrightness / count : 255;
            if (avgBrightness < threshValue) {
              const radius = (dotSize / 2) * (1 - avgBrightness / 255);
              if (radius > 0.5) {
                ctx.beginPath();
                if (shapeMode === 'dot') {
                  ctx.arc(x + dotSize / 2, y + dotSize / 2, radius, 0, Math.PI * 2);
                } else {
                  ctx.rect(x, y + (dotSize - radius * 2) / 2, dotSize, radius * 2);
                }
                ctx.fill();
              }
            }
          }
        }
      }
    }
    return tempCanvas;
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
        const convertedCanvas = applyMonochromeFilter(imgObj, threshold, activeInkColor, halftoneEnabled ? halftoneDotSize : 0, halftoneShape);
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
        (fabricImg as any)._halftoneDotSize = halftoneEnabled ? halftoneDotSize : 0;
        (fabricImg as any)._halftoneShape = halftoneShape;

        fabricImg.scaleToWidth(200);
        fabricCanvas.add(fabricImg);
        fabricCanvas.setActiveObject(fabricImg);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateImageThreshold = (newThresh: number) => {
    setThreshold(newThresh);
    if (!fabricCanvas) return;

    const activeObj = fabricCanvas.getActiveObject() as any;
    if (activeObj) {
      let targetImg = activeObj;
      if (activeObj._isMaskGroup) {
        const groupObjs = activeObj.getObjects ? activeObj.getObjects() : [];
        targetImg = groupObjs.find((o: any) => o.type === 'image') || activeObj._maskedImage;
      }

      if (targetImg && targetImg._originalImgElement) {
        const color = targetImg._inkColor || activeInkColor;
        targetImg._threshold = newThresh;
        const dotSizeVal = targetImg._halftoneDotSize !== undefined ? targetImg._halftoneDotSize : (halftoneEnabled ? halftoneDotSize : 0);
        const shapeVal = targetImg._halftoneShape || halftoneShape;
        const newCanvas = applyMonochromeFilter(
          targetImg._originalImgElement,
          newThresh,
          color,
          dotSizeVal,
          shapeVal
        );
        targetImg.setElement(newCanvas);
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  const updateHalftoneSettings = (enabled: boolean, size: number, shape: 'dot' | 'line') => {
    setHalftoneEnabled(enabled);
    setHalftoneDotSize(size);
    setHalftoneShape(shape);

    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject() as any;
    if (activeObj) {
      let targetImg = activeObj;
      if (activeObj._isMaskGroup) {
        const groupObjs = activeObj.getObjects ? activeObj.getObjects() : [];
        targetImg = groupObjs.find((o: any) => o.type === 'image') || activeObj._maskedImage;
      }

      if (targetImg && targetImg._originalImgElement) {
        const color = targetImg._inkColor || activeInkColor;
        const thresh = targetImg._threshold !== undefined ? targetImg._threshold : threshold;
        const dotSizeVal = enabled ? size : 0;
        targetImg._halftoneDotSize = dotSizeVal;
        targetImg._halftoneShape = shape;

        const newCanvas = applyMonochromeFilter(targetImg._originalImgElement, thresh, color, dotSizeVal, shape);
        targetImg.setElement(newCanvas);
        fabricCanvas.renderAll();
        saveHistory(fabricCanvas);
      }
    }
  };

  const saveProjectAsJson = () => {
    if (!fabricCanvas) return;

    if (maskEditingCtxRef.current) {
      exitMaskEditMode();
    }

    const defaultName = `flyer_project_${selectedSize}`;
    const fileName = prompt('保存するプロジェクト名を入力してください:', defaultName);
    if (!fileName) return;

    const jsonCanvasData = fabricCanvas.toDatalessJSON([
      '_isMaskGroup',
      '_isGeneralGroup',
      '_maskedImage',
      '_frameShape',
      '_originalImgSrc',
      '_maskFrameData',
      '_inkColor',
      '_customName',
      '_threshold',
      '_halftoneDotSize',
      '_halftoneShape',
      '_isGuideLine',
      '_isGridLine',
      'visible',
    ]);

    const projectData = {
      version: '1.0',
      selectedSize,
      paperColor,
      canvasData: jsonCanvasData,
    };

    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadProjectFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (event) => {
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
                const groupObjs = obj.getObjects ? obj.getObjects() : [];
                const img = groupObjs.find((o: any) => o.type === 'image') || obj._maskedImage;
                if (img && img._originalImgSrc) {
                  const p = new Promise<void>((resolve) => {
                    const el = new Image();
                    el.src = img._originalImgSrc;
                    el.onload = () => {
                      img._originalImgElement = el;
                      const thresh = img._threshold !== undefined ? img._threshold : 128;
                      const ink = img._inkColor || '#000000';
                      const filteredCanvas = applyMonochromeFilter(
                        el,
                        thresh,
                        ink,
                        img._halftoneDotSize || 0,
                        img._halftoneShape || 'dot'
                      );
                      img.setElement(filteredCanvas);
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
                    const thresh = obj._threshold !== undefined ? obj._threshold : 128;
                    const ink = obj._inkColor || '#000000';
                    const filteredCanvas = applyMonochromeFilter(
                      el,
                      thresh,
                      ink,
                      obj._halftoneDotSize || 0,
                      obj._halftoneShape || 'dot'
                    );
                    obj.setElement(filteredCanvas);
                    resolve();
                  };
                  el.onerror = () => resolve();
                });
                processPromises.push(p);
              }
            });

            await Promise.all(processPromises);

            fabricCanvas.renderAll();
            refreshObjectsList(fabricCanvas);
            drawGrid(fabricCanvas);
            isBatchLoadingRef.current = false;
            saveHistory(fabricCanvas);
          });
        }
      } catch (err) {
        console.error('JSON読み込みエラー:', err);
        isBatchLoadingRef.current = false;
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
    const targetObj = objectsList[dropIndex] as any;

    if (draggedObj.type === 'image' && (targetObj.type === 'rect' || targetObj.type === 'circle')) {
      createMaskGroup(draggedObj, targetObj);
      setHasMask(true);
    } else {
      createGroupFromObjects(draggedObj, targetObj);
    }

    refreshObjectsList(fabricCanvas);
  };

  const moveLayerOrder = (action: 'bringToFront' | 'bringForward' | 'sendBackwards' | 'sendToBack') => {
    if (!fabricCanvas || !activeObject) return;

    if (action === 'bringToFront') {
      fabricCanvas.bringObjectToFront(activeObject);
    } else if (action === 'bringForward') {
      fabricCanvas.bringObjectForward(activeObject);
    } else if (action === 'sendBackwards') {
      fabricCanvas.sendObjectBackwards(activeObject);
    } else if (action === 'sendToBack') {
      fabricCanvas.sendObjectToBack(activeObject);
      gridLinesRef.current.forEach((line) => fabricCanvas.sendObjectToBack(line));
    }

    fabricCanvas.renderAll();
    refreshObjectsList(fabricCanvas);
    saveHistory(fabricCanvas);
  };

  const duplicateSelectedLayer = async (targetObj?: fabric.Object) => {
    if (!fabricCanvas) return;
    const objToClone = targetObj || fabricCanvas.getActiveObject();
    if (!objToClone) return;

    try {
      const cloned = await objToClone.clone();
      cloned.set({
        left: (cloned.left || 0) + 15,
        top: (cloned.top || 0) + 15,
      });
      (cloned as any)._customName = (objToClone as any)._customName ? `${(objToClone as any)._customName} (コピー)` : undefined;
      (cloned as any)._inkColor = (objToClone as any)._inkColor;

      fabricCanvas.add(cloned);
      fabricCanvas.setActiveObject(cloned);
      fabricCanvas.renderAll();
      refreshObjectsList(fabricCanvas);
      saveHistory(fabricCanvas);
    } catch (err) {
      console.error('複製処理エラー:', err);
    }
  };

  const toggleVisibility = (obj: fabric.Object, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fabricCanvas) return;
    obj.set('visible', !obj.visible);
    fabricCanvas.renderAll();
    refreshObjectsList(fabricCanvas);
    saveHistory(fabricCanvas);
  };

  const toggleGroupExpand = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const renameLayer = (obj: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentName = obj._customName || '';
    const newName = prompt('レイヤーの名前を入力してください:', currentName);

    if (newName !== null) {
      obj._customName = newName.trim();
      refreshObjectsList(fabricCanvas!);
      saveHistory(fabricCanvas!);
    }
  };

  const handleLayerClick = (obj: fabric.Object, e: React.MouseEvent) => {
    if (!fabricCanvas) return;

    if (e.shiftKey) {
      const activeObj = fabricCanvas.getActiveObject();
      if (!activeObj) {
        fabricCanvas.setActiveObject(obj);
      } else if (activeObj.type === 'activeSelection') {
        const selection = activeObj as fabric.ActiveSelection;
        const currentObjects = selection.getObjects();
        if (currentObjects.includes(obj)) {
          selection.remove(obj);
          if (selection.size() === 1) {
            fabricCanvas.setActiveObject(selection.getObjects()[0]);
          }
        } else {
          selection.addWithUpdate(obj);
        }
      } else {
        if (activeObj !== obj) {
          const selection = new fabric.ActiveSelection([activeObj, obj], {
            canvas: fabricCanvas,
          });
          fabricCanvas.setActiveObject(selection);
        }
      }
    } else {
      fabricCanvas.setActiveObject(obj);
    }
    fabricCanvas.renderAll();
  };

  const deleteSelected = (targetObj?: fabric.Object) => {
    if (!fabricCanvas) return;
    if (targetObj) {
      fabricCanvas.remove(targetObj);
      if (fabricCanvas.getActiveObject() === targetObj) {
        fabricCanvas.discardActiveObject();
      }
    } else {
      const activeObjects = fabricCanvas.getActiveObjects();
      activeObjects.forEach((obj) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
    }
    fabricCanvas.renderAll();
    refreshObjectsList(fabricCanvas);
    saveHistory(fabricCanvas);
  };

  const exportImage = (isTransparent: boolean) => {
    if (!fabricCanvas) return;

    if (maskEditingCtxRef.current) {
      exitMaskEditMode();
    }

    const defaultName = `flyer_${selectedSize}_${isTransparent ? 'transparent' : 'preview'}`;
    const fileName = prompt('保存するファイル名を入力してください:', defaultName);
    if (!fileName) return;

    guideLinesRef.current.forEach((obj) => fabricCanvas.remove(obj));
    gridLinesRef.current.forEach((line) => fabricCanvas.remove(line));

    const originalBg = fabricCanvas.backgroundColor;

    if (isTransparent) {
      fabricCanvas.backgroundColor = 'transparent';
    } else {
      fabricCanvas.backgroundColor = paperColor;
    }

    fabricCanvas.renderAll();

    const dataUrl = fabricCanvas.toDataURL({
      format: isTransparent ? 'png' : 'jpeg',
      quality: 1,
      multiplier: 3,
    });

    fabricCanvas.backgroundColor = originalBg;
    drawGrid(fabricCanvas);
    fabricCanvas.renderAll();

    const link = document.createElement('a');
    link.download = `${fileName}.${isTransparent ? 'png' : 'jpg'}`;
    link.href = dataUrl;
    link.click();
  };

  const getObjectLabel = (obj: any) => {
    if (obj._customName && obj._customName.trim() !== '') {
      return obj._customName;
    }
    if (obj._isMaskGroup) return 'マスクグループ';
    if (obj._isGeneralGroup || obj.type === 'group') return 'レイヤーグループ';
    if (obj.type === 'i-text' || obj.type === 'textbox') {
      const txt = (obj as fabric.IText).text || '';
      return `${txt.slice(0, 12)}${txt.length > 12 ? '...' : ''}`;
    }
    if (obj.type === 'rect') return '四角枠';
    if (obj.type === 'circle') return '円枠';
    if (obj.type === 'path') return 'パス・素材パーツ';
    if (obj.type === 'image') return '画像';
    return 'パーツ';
  };

  const isObjectInSelection = (obj: fabric.Object) => {
    if (!activeObject) return false;
    if (activeObject === obj) return true;
    if (activeObject.type === 'activeSelection') {
      return (activeObject as fabric.ActiveSelection).getObjects().includes(obj);
    }
    return false;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* 左操作パネル */}
      <div style={{ width: '340px', backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0', color: '#111827' }}>レトロチラシ作成ツール</h1>

        {/* プロジェクト保存・読み込み */}
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
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* グリッド・スナップ・ガイド機能 */}
        <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <label style={{ ...labelStyle, marginBottom: '6px' }}>📏 ガイド・グリッド設定</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              グリッド表示
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={enableSnap} onChange={(e) => setEnableSnap(e.target.checked)} />
              位置吸着（スナップ機能）
            </label>
            {showGrid && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ color: '#64748b', fontSize: '11px' }}>グリッドサイズ:</span>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value) || 20)}
                  style={{ width: '50px', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ color: '#64748b', fontSize: '11px' }}>px</span>
              </div>
            )}
          </div>
        </div>

        {/* 素材追加 */}
        <div>
          <label style={labelStyle}>3. 素材を追加</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => addText('title')} style={{ ...btnStyle, flex: 1 }}>＋ 見出し</button>
              <button onClick={() => addText('body')} style={{ ...btnStyle, flex: 1 }}>＋ 本文</button>
            </div>
            <button onClick={() => addText('paragraph')} style={{ ...btnStyle, textAlign: 'center' }}>
              ＋ 本文の段落ブロック
            </button>
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

          {/* 自由変形 (Skew) */}
          <div style={{ marginBottom: '10px', borderTop: '1px dashed #d1d5db', paddingTop: '6px' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>自由変形 (歪み・斜体)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>X方向歪み: {skewX}°</span>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={skewX}
                  onChange={(e) => handleSkewChange('x', Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>Y方向歪み: {skewY}°</span>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={skewY}
                  onChange={(e) => handleSkewChange('y', Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* カラー変更 */}
          {hasMask ? (
            <div style={{ marginBottom: '10px', backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', display: 'block', marginBottom: '6px' }}>
                🎨 マスクグループの色指定
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>全体に適用</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {INK_COLORS.map((ink) => (
                      <button
                        key={`all_${ink.name}`}
                        onClick={() => changeInkColor(ink.hex, 'all')}
                        style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: ink.hex, border: '1px solid #d1d5db', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
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
                        style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: ink.hex, border: '1px solid #d1d5db', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
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
                        style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: ink.hex, border: '1px solid #d1d5db', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                        title={`写真を${ink.name}にする`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>プリント（文字・画像・枠）の色</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                {INK_COLORS.map((ink) => (
                  <button
                    key={ink.name}
                    onClick={() => changeInkColor(ink.hex, 'all')}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: ink.hex,
                      border: activeInkColor === ink.hex ? '3px solid #000' : '1px solid #d1d5db',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                    title={ink.name}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>カスタム色:</span>
                <input
                  type="color"
                  value={activeInkColor}
                  onChange={(e) => changeInkColor(e.target.value, 'all')}
                  style={{ width: '28px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                />
                <input
                  type="text"
                  value={activeInkColor}
                  onChange={(e) => changeInkColor(e.target.value, 'all')}
                  placeholder="#000000"
                  style={{ width: '70px', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>
          )}

          {(selectedObjectType === 'rect' || selectedObjectType === 'circle' || selectedObjectType === 'path') && (
            <div style={{ marginBottom: '8px', borderTop: '1px dashed #d1d5db', paddingTop: '6px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>図形の中の塗りつぶし</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => changeShapeFillColor('transparent')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: shapeFillColor === 'transparent' ? '2.5px solid #1e293b' : '2px solid #94a3b8',
                    backgroundColor: '#ffffff',
                    backgroundImage: `linear-gradient(45deg, #cbd5e1 25%, transparent 25%), 
                                      linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), 
                                      linear-gradient(45deg, transparent 75%, #cbd5e1 75%), 
                                      linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)`,
                    backgroundSize: '8px 8px',
                    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  <span style={{ backgroundColor: '#ffffff', padding: '0 4px', borderRadius: '2px', border: '1px solid #cbd5e1' }}>透明</span>
                </button>
                <input
                  type="color"
                  value={shapeFillColor === 'transparent' ? '#ffffff' : shapeFillColor}
                  onChange={(e) => changeShapeFillColor(e.target.value)}
                  style={{ width: '28px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                />
                <input
                  type="text"
                  value={shapeFillColor}
                  onChange={(e) => changeShapeFillColor(e.target.value)}
                  placeholder="transparent"
                  style={{ width: '80px', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>
          )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
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

            {/* テキスト専用コントロール */}
            <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => toggleWritingMode('horizontal')}
                  style={{
                    flex: 1,
                    padding: '4px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    backgroundColor: writingMode === 'horizontal' ? '#000' : '#fff',
                    color: writingMode === 'horizontal' ? '#fff' : '#000',
                    cursor: 'pointer',
                  }}
                >
                  横書き
                </button>
                <button
                  onClick={() => toggleWritingMode('vertical')}
                  style={{
                    flex: 1,
                    padding: '4px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    backgroundColor: writingMode === 'vertical' ? '#000' : '#fff',
                    color: writingMode === 'vertical' ? '#fff' : '#000',
                    cursor: 'pointer',
                  }}
                >
                  縦書き
                </button>
              </div>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>揃え:</span>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => {
                      setTextAlign(align);
                      updateTextProp('textAlign', align);
                    }}
                    style={{
                      flex: 1,
                      padding: '2px',
                      fontSize: '10px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      backgroundColor: textAlign === align ? '#000' : '#fff',
                      color: textAlign === align ? '#fff' : '#000',
                      cursor: 'pointer',
                    }}
                  >
                    {align === 'left' ? '左' : align === 'center' ? '中央' : '右'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>文字間隔</span>
                  <input
                    type="number"
                    value={charSpacing}
                    step="10"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCharSpacing(val);
                      updateTextProp('charSpacing', val);
                    }}
                    style={{ width: '100%', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>行間</span>
                  <input
                    type="number"
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLineHeight(val);
                      updateTextProp('lineHeight', val);
                    }}
                    style={{ width: '100%', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '4px' }}>
                <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>袋文字（縁取り）設定</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={textStrokeColor}
                    onChange={(e) => {
                      setTextStrokeColor(e.target.value);
                      updateTextProp('stroke', e.target.value);
                    }}
                    style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  />
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>太さ:</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={textStrokeWidth}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTextStrokeWidth(val);
                      updateTextProp('strokeWidth', val);
                    }}
                    style={{ width: '50px', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>px</span>
                </div>
              </div>
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

              {/* トーン・網点処理 (Halftone) パネル */}
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '4px' }}>
                  <input
                    type="checkbox"
                    checked={halftoneEnabled}
                    onChange={(e) => updateHalftoneSettings(e.target.checked, halftoneDotSize, halftoneShape)}
                  />
                  🏁 トーン・網点処理 (Halftone)
                </label>

                {halftoneEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => updateHalftoneSettings(true, halftoneDotSize, 'dot')}
                        style={{
                          flex: 1,
                          padding: '2px 4px',
                          fontSize: '10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          backgroundColor: halftoneShape === 'dot' ? '#000' : '#fff',
                          color: halftoneShape === 'dot' ? '#fff' : '#000',
                          cursor: 'pointer',
                        }}
                      >
                        ● 丸ドット
                      </button>
                      <button
                        onClick={() => updateHalftoneSettings(true, halftoneDotSize, 'line')}
                        style={{
                          flex: 1,
                          padding: '2px 4px',
                          fontSize: '10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          backgroundColor: halftoneShape === 'line' ? '#000' : '#fff',
                          color: halftoneShape === 'line' ? '#fff' : '#000',
                          cursor: 'pointer',
                        }}
                      >
                        〓 ライン
                      </button>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>ドットサイズ: {halftoneDotSize}px</span>
                      <input
                        type="range"
                        min="2"
                        max="20"
                        value={halftoneDotSize}
                        onChange={(e) => updateHalftoneSettings(true, Number(e.target.value), halftoneShape)}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                )}
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

        {/* スタンプ・素材ライブラリ */}
        <div style={{ backgroundColor: '#fffbebfb', padding: '10px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
          <label style={{ ...labelStyle, color: '#92400e', marginBottom: '6px' }}>🎨 スタンプ・素材ライブラリ</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#78350f', fontWeight: 'bold' }}>切り抜き・装飾アルファベット文字</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {RETRO_TEXT_STYLES.map((st, idx) => (
                <button
                  key={idx}
                  onClick={() => addRetroTextStyle(st)}
                  style={{ ...btnStyle, fontSize: '10px', backgroundColor: '#ffffff', borderColor: '#fde68a', cursor: 'pointer' }}
                >
                  ➕ {st.label}
                </button>
              ))}
            </div>

            <span style={{ fontSize: '10px', color: '#78350f', fontWeight: 'bold', marginTop: '4px' }}>レトロスタンプ・パーツ</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {STAMP_PRESETS.map((pst) => (
                <button
                  key={pst.id}
                  onClick={() => addStampPreset(pst.id)}
                  style={{ ...btnStyle, fontSize: '10px', backgroundColor: '#ffffff', borderColor: '#fde68a', cursor: 'pointer' }}
                >
                  ➕ {pst.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 画像保存 */}
        <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
          <label style={labelStyle}>5. 画像として保存</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => exportImage(false)} style={{ ...btnStyle, flex: 1, backgroundColor: '#000000', color: '#ffffff', fontWeight: 'bold', textAlign: 'center' }}>
              プレビュー保存
            </button>
            <button onClick={() => exportImage(true)} style={{ ...btnStyle, flex: 1, backgroundColor: '#4b5563', color: '#ffffff', fontWeight: 'bold', textAlign: 'center' }}>
              透過PNG保存
            </button>
          </div>
        </div>
      </div>

      {/* 中央キャンバスプレビュー */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'auto', padding: '20px' }}>
        <div style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', borderRadius: '4px', overflow: 'hidden' }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* 右レイヤー管理パネル */}
      <div style={{ width: '280px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0', color: '#111827' }}>レイヤー一覧</h2>

        {/* 選択オブジェクト操作ボタン */}
        {activeObject && (
          <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>順序 / グループ・複製</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              <button onClick={() => moveLayerOrder('bringToFront')} style={layerOrderBtnStyle} title="最前面へ">最前面</button>
              <button onClick={() => moveLayerOrder('bringForward')} style={layerOrderBtnStyle} title="前面へ">前面</button>
              <button onClick={() => moveLayerOrder('sendBackwards')} style={layerOrderBtnStyle} title="背面へ">背面</button>
              <button onClick={() => moveLayerOrder('sendToBack')} style={layerOrderBtnStyle} title="最背面へ">最背面</button>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => duplicateSelectedLayer()} style={{ ...btnStyle, flex: 1, padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}>
                📋 複製
              </button>
              {((activeObject as any)._isGeneralGroup || (activeObject as any)._isMaskGroup || activeObject.type === 'group') && (
                <button onClick={ungroupGeneralGroup} style={{ ...btnStyle, flex: 1, padding: '4px 6px', fontSize: '11px', textAlign: 'center', backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
                  🔓 解除
                </button>
              )}
            </div>
          </div>
        )}

        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
          💡 重ね順の変更はドラッグ＆ドロップでも行えます。画像を枠の上に落とすとマスクが作成されます。 Shift+クリックで複数選択。
        </p>

        {/* レイヤーリスト（アコーディオン表示＆直接選択機能） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          {objectsList.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>
              パーツがありません
            </div>
          ) : (
            objectsList.map((obj: any, index) => {
              const isSelected = isObjectInSelection(obj);
              const isGroup = obj._isGeneralGroup || obj._isMaskGroup || obj.type === 'group';
              const isExpanded = !!expandedGroups[index];
              const groupChildren = isGroup && obj.getObjects ? obj.getObjects() : [];

              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={(e) => handleLayerClick(obj, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      padding: '8px',
                      borderRadius: '6px',
                      border: dragOverIndex === index ? '2px solid #2563eb' : isSelected ? '2px solid #000000' : '1px solid #d1d5db',
                      backgroundColor: isSelected ? '#f3f4f6' : '#ffffff',
                      cursor: 'grab',
                      fontSize: '12px',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
                      {isGroup && (
                        <button
                          onClick={(e) => toggleGroupExpand(index, e)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', color: '#6b7280' }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      )}
                      <span style={{ fontWeight: isSelected ? 'bold' : 'normal', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {getObjectLabel(obj)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={(e) => renameLayer(obj, e)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
                        title="名前変更"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => toggleVisibility(obj, e)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
                        title={obj.visible ? '非表示にする' : '表示する'}
                      >
                        {obj.visible !== false ? '👁️' : '🙈'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSelected(obj);
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', fontSize: '12px', color: '#ef4444' }}
                        title="削除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* グループ内部の個別レイヤー表示 */}
                  {isGroup && isExpanded && (
                    <div style={{ marginLeft: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #e5e7eb', paddingLeft: '8px' }}>
                      {groupChildren.map((child: any, cIdx: number) => (
                        <div
                          key={cIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (fabricCanvas) {
                              fabricCanvas.setActiveObject(child);
                              fabricCanvas.renderAll();
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justify: 'space-between',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: activeObject === child ? '#e0e7ff' : '#f8fafc',
                            border: '1px solid #cbd5e1',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{getObjectLabel(child)}</span>
                        </div>
                      ))}
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