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

  // 入力プロパティ（文字全消去対応）
  const [strokeWidthInput, setStrokeWidthInput] = useState<string>('4');
  const [fontSizeInput, setFontSizeInput] = useState<string>('32');
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [threshold, setThreshold] = useState<number>(128);
  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);

  // レイヤー一覧
  const [objectsList, setObjectsList] = useState<fabric.Object[]>([]);
  const [activeObject, setActiveObject] = useState<fabric.Object | null>(null);

  // ドラッグ＆ドロップ管理
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const guideLinesRef = useRef<fabric.Line[]>([]);

  // レイヤー更新
  const refreshObjectsList = (canvas: fabric.Canvas) => {
    const objs = canvas.getObjects().filter((obj) => obj.type !== 'line');
    setObjectsList([...objs].reverse()); // 画面手前のものをリストの上にする
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

    // スマートガイド（揃え位置スナップ）
    canvas.on('object:moving', (e) => {
      clearGuides();
      const target = e.target;
      if (!target) return;

      const targetCenter = target.getCenterPoint();
      const snapThreshold = 6;

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
        const objCenter = obj.getCenterPoint();

        if (Math.abs(targetCenter.x - objCenter.x) < snapThreshold) {
          target.setPositionByOrigin(new fabric.Point(objCenter.x, targetCenter.y), 'center', 'center');
          drawGuideLine(objCenter.x, 0, objCenter.x, size.height);
        }
        if (Math.abs(targetCenter.y - objCenter.y) < snapThreshold) {
          target.setPositionByOrigin(new fabric.Point(targetCenter.x, objCenter.y), 'center', 'center');
          drawGuideLine(0, size.height / 2, size.width, size.height / 2);
        }
      });

      canvas.renderAll();
    });

    canvas.on('object:modified', clearGuides);
    canvas.on('selection:cleared', clearGuides);

    const handleSelection = () => {
      const activeObj = canvas.getActiveObject();
      setActiveObject(activeObj || null);
      if (activeObj) {
        setSelectedObjectType(activeObj.type);
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
      }
      refreshObjectsList(canvas);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => {
      setActiveObject(null);
      setSelectedObjectType(null);
      refreshObjectsList(canvas);
    });

    canvas.on('object:added', () => refreshObjectsList(canvas));
    canvas.on('object:removed', () => refreshObjectsList(canvas));

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [selectedSize]);

  const handleColorChange = (color: string) => {
    setPaperColor(color);
    if (fabricCanvas) {
      fabricCanvas.backgroundColor = color;
      fabricCanvas.renderAll();
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
        activeObj.set('strokeWidth', num);
        fabricCanvas.renderAll();
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
    }
  };

  // モノクロ変換処理
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
    if (activeObj && activeObj.type === 'image' && activeObj._originalImg) {
      const newCanvas = applyMonochromeFilter(activeObj._originalImg, newThresh);
      activeObj.setElement(newCanvas);
      fabricCanvas.renderAll();
    }
  };

  // 高精度マスク（クリッピング）処理
  const applyMaskToImage = (imageObj: fabric.Image, targetShape: fabric.Object) => {
    if (!fabricCanvas) return;

    const shapeCenter = targetShape.getCenterPoint();
    imageObj.setPositionByOrigin(shapeCenter, 'center', 'center');

    let clipPath: fabric.Object;

    if (targetShape.type === 'circle') {
      const circle = targetShape as fabric.Circle;
      const radius = circle.radius * circle.scaleX;
      clipPath = new fabric.Circle({
        radius: radius / imageObj.scaleX,
        originX: 'center',
        originY: 'center',
      });
    } else {
      const rect = targetShape as fabric.Rect;
      const w = (rect.width * rect.scaleX) / imageObj.scaleX;
      const h = (rect.height * rect.scaleY) / imageObj.scaleY;
      clipPath = new fabric.Rect({
        width: w,
        height: h,
        originX: 'center',
        originY: 'center',
      });
    }

    imageObj.set('clipPath', clipPath);
    fabricCanvas.renderAll();
  };

  // ドラッグ＆ドロップ処理（レイヤー重ね合わせでマスク発動）
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || !fabricCanvas) return;

    const draggedObj = objectsList[draggedIndex];
    const targetObj = objectsList[dropIndex];

    // 「画像」を「四角または円」の上にドロップした場合、自動でマスク実行
    if (draggedObj.type === 'image' && (targetObj.type === 'rect' || targetObj.type === 'circle')) {
      applyMaskToImage(draggedObj as fabric.Image, targetObj);
      fabricCanvas.setActiveObject(draggedObj);
    } else {
      // 通常のレイヤー入れ替え処理
      if (draggedIndex > dropIndex) {
        fabricCanvas.bringObjectForward(draggedObj);
      } else {
        fabricCanvas.sendObjectBackwards(draggedObj);
      }
      fabricCanvas.renderAll();
    }

    refreshObjectsList(fabricCanvas);
    setDraggedIndex(null);
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

  const getObjectLabel = (obj: fabric.Object) => {
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

        {/* 選択パーツ編集 */}
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

          {selectedObjectType === 'image' && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px' }}>
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
          )}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={deleteSelected} style={{ ...btnStyle, color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2', textAlign: 'center' }}>
            🗑 選択した要素を削除
          </button>
          <button onClick={exportForPrint} style={{ padding: '10px', backgroundColor: '#000000', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            ⬇ 印刷用データ出力 (PNG)
          </button>
        </div>
      </div>

      {/* キャンバス表示エリア */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto' }}>
        <div style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #d1d5db', lineHeight: 0 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* 右レイヤーパネル（ドラッグ＆ドロップ対応） */}
      <div style={{ width: '230px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0', color: '#111827' }}>レイヤー一覧</h2>
        <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
          💡 画像を「四角」や「円」の上にドラッグ＆ドロップすると枠型にマスクされます。
        </p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {objectsList.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>要素がありません</p>
          ) : (
            objectsList.map((obj, index) => {
              const isSelected = activeObject === obj;
              return (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
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
                    border: '1px dashed',
                    borderColor: isSelected ? '#000000' : '#d1d5db',
                    backgroundColor: isSelected ? '#f3f4f6' : '#ffffff',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getObjectLabel(obj)}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>⣿</span>
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