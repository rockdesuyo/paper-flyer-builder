import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';

// 用紙サイズの比率設定 (px換算)
const PAPER_SIZES = {
  A4: { width: 420, height: 595, label: 'A4' },
  A3: { width: 500, height: 707, label: 'A3' },
  SQUARE: { width: 500, height: 500, label: 'スクエア' },
};

// カラー上質紙の背景色サンプル
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

// フォント一覧
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

  // 選択中のオブジェクトプロパティ
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [fontSize, setFontSize] = useState<number>(32);
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);

  // Canvasの初期化
  useEffect(() => {
    if (!canvasRef.current) return;

    const size = PAPER_SIZES[selectedSize];
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: paperColor,
    });

    // 選択イベントの監視
    const handleSelection = () => {
      const activeObj = canvas.getActiveObject();
      if (activeObj) {
        setSelectedObjectType(activeObj.type);
        if (activeObj.strokeWidth) setStrokeWidth(activeObj.strokeWidth);
        if ((activeObj as fabric.IText).fontSize) setFontSize((activeObj as fabric.IText).fontSize);
        if ((activeObj as fabric.IText).fontFamily) setFontFamily((activeObj as fabric.IText).fontFamily);
      } else {
        setSelectedObjectType(null);
      }
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => setSelectedObjectType(null));

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [selectedSize]);

  // 背景色の変更
  const handleColorChange = (color: string) => {
    setPaperColor(color);
    if (fabricCanvas) {
      fabricCanvas.backgroundColor = color;
      fabricCanvas.renderAll();
    }
  };

  // テキスト追加（見出し / 本文）
  const addText = (isTitle: boolean) => {
    if (!fabricCanvas) return;
    const text = new fabric.IText(isTitle ? '見出しタイトル' : 'ここへ本文テキストを入力します。', {
      left: 50,
      top: 50,
      fontFamily: fontFamily,
      fontSize: isTitle ? 36 : 18,
      fontWeight: isTitle ? 'bold' : 'normal',
      fill: '#000000',
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  // 図形追加
  const addRectangle = () => {
    if (!fabricCanvas) return;
    const rect = new fabric.Rect({
      left: 50,
      top: 120,
      width: 150,
      height: 100,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: strokeWidth,
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: strokeWidth,
    });
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
  };

  // 選択中の線の太さ変更
  const updateStrokeWidth = (width: number) => {
    setStrokeWidth(width);
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj) {
      activeObj.set('strokeWidth', width);
      fabricCanvas.renderAll();
    }
  };

  // 選択中のフォントサイズ変更
  const updateFontSize = (size: number) => {
    setFontSize(size);
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      (activeObj as fabric.IText).set('fontSize', size);
      fabricCanvas.renderAll();
    }
  };

  // 選択中のフォント変更
  const updateFontFamily = (family: string) => {
    setFontFamily(family);
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      (activeObj as fabric.IText).set('fontFamily', family);
      fabricCanvas.renderAll();
    }
  };

  // 画像アップロード & モノクロ2値化
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgObj = new Image();
      imgObj.src = event.target?.result as string;
      imgObj.onload = () => {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = imgObj.width;
        tempCanvas.height = imgObj.height;

        if (ctx) {
          ctx.drawImage(imgObj, 0, 0);
          const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (avg < 128) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 255;
            } else {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);

          const fabricImg = new fabric.Image(tempCanvas, {
            left: 50,
            top: 50,
          });
          fabricImg.scaleToWidth(200);
          fabricCanvas.add(fabricImg);
          fabricCanvas.setActiveObject(fabricImg);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // 画像のトリミング（正方形・円形マスク）
  const cropImage = (type: 'rect' | 'circle') => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject() as fabric.Image;
    if (!activeObj || activeObj.type !== 'image') return;

    const width = activeObj.width * activeObj.scaleX;
    const height = activeObj.height * activeObj.scaleY;
    const minSize = Math.min(width, height);

    let clipPath: fabric.Object;
    if (type === 'circle') {
      clipPath = new fabric.Circle({
        radius: minSize / (2 * activeObj.scaleX),
        originX: 'center',
        originY: 'center',
      });
    } else {
      clipPath = new fabric.Rect({
        width: minSize / activeObj.scaleX,
        height: minSize / activeObj.scaleY,
        originX: 'center',
        originY: 'center',
      });
    }

    activeObj.set('clipPath', clipPath);
    fabricCanvas.renderAll();
  };

  // 選択要素の削除
  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    activeObjects.forEach((obj) => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
  };

  // 印刷用データ出力（ファイル名指定）
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

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* サイドバー（操作パネル） */}
      <div style={{ width: '340px', backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0', color: '#111827' }}>レトロチラシ作成ツール</h1>

        {/* 1. 用紙サイズ */}
        <div>
          <label style={labelStyle}>1. 用紙サイズ</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(Object.keys(PAPER_SIZES) as Array<keyof typeof PAPER_SIZES>).map((sizeKey) => (
              <button
                key={sizeKey}
                onClick={() => setSelectedSize(sizeKey)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '13px',
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

        {/* 2. 用紙カラー */}
        <div>
          <label style={labelStyle}>2. 用紙カラー（プレビュー）</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {PAPER_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => handleColorChange(c.color)}
                style={{
                  width: '40px',
                  height: '40px',
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

        {/* 3. 素材追加 */}
        <div>
          <label style={labelStyle}>3. 素材を追加</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => addText(true)} style={{ ...btnStyle, flex: 1 }}>＋ 見出し追加</button>
              <button onClick={() => addText(false)} style={{ ...btnStyle, flex: 1 }}>＋ 本文追加</button>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={addRectangle} style={{ ...btnStyle, flex: 1 }}>＋ 四角枠線</button>
              <button onClick={addCircle} style={{ ...btnStyle, flex: 1 }}>＋ 円枠線</button>
            </div>
            <label style={{ ...btnStyle, textAlign: 'center', cursor: 'pointer', marginTop: '2px' }}>
              📷 画像を追加（モノクロ変換）
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* 4. 選択中オブジェクトの調整（コンテキストメニュー） */}
        <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <label style={{ ...labelStyle, marginBottom: '8px' }}>4. 選択中パーツの編集</label>
          
          {/* 線の太さ調整 */}
          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>線の太さ: {strokeWidth}px</span>
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => updateStrokeWidth(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* フォント調整 */}
          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>フォント・文字サイズ</span>
            <select
              value={fontFamily}
              onChange={(e) => updateFontFamily(e.target.value)}
              style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', marginBottom: '6px' }}
            >
              {FONTS.map((f) => (
                <option key={f.name} value={f.family}>{f.name}</option>
              ))}
            </select>
            <input
              type="range"
              min="12"
              max="100"
              value={fontSize}
              onChange={(e) => updateFontSize(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* 画像のトリミング */}
          {selectedObjectType === 'image' && (
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>画像をトリミング</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => cropImage('rect')} style={{ ...btnStyle, flex: 1, padding: '6px', fontSize: '11px' }}>正方形で切抜</button>
                <button onClick={() => cropImage('circle')} style={{ ...btnStyle, flex: 1, padding: '6px', fontSize: '11px' }}>円形で切抜</button>
              </div>
            </div>
          )}
        </div>

        {/* 削除・出力ボタン */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={deleteSelected} style={{ ...btnStyle, color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2', textAlign: 'center' }}>
            🗑 選択した要素を削除
          </button>
          <button onClick={exportForPrint} style={{ padding: '12px', backgroundColor: '#000000', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
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
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#374151',
  marginBottom: '6px',
};

const btnStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: '12px',
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  cursor: 'pointer',
  textAlign: 'left',
};