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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedSize, setSelectedSize] = useState<keyof typeof PAPER_SIZES>('A4');
  const [paperColor, setPaperColor] = useState<string>('#ff944d');

  // Canvasの初期化
  useEffect(() => {
    if (!canvasRef.current) return;

    const size = PAPER_SIZES[selectedSize];
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: paperColor,
    });

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

  // テキスト追加
  const addText = () => {
    if (!fabricCanvas) return;
    const text = new fabric.IText('ZUTOMAYO', {
      left: 50,
      top: 50,
      fontFamily: 'sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fill: '#000000',
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  // 四角枠線追加
  const addRectangle = () => {
    if (!fabricCanvas) return;
    const rect = new fabric.Rect({
      left: 50,
      top: 120,
      width: 200,
      height: 150,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 4,
    });
    fabricCanvas.add(rect);
  };

  // 円枠線追加
  const addCircle = () => {
    if (!fabricCanvas) return;
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 60,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 4,
    });
    fabricCanvas.add(circle);
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
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // 選択要素の削除
  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    activeObjects.forEach((obj) => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
  };

  // 印刷用データ出力
  const exportForPrint = () => {
    if (!fabricCanvas) return;
    fabricCanvas.backgroundColor = 'transparent';
    fabricCanvas.renderAll();

    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      multiplier: 3,
    });

    fabricCanvas.backgroundColor = paperColor;
    fabricCanvas.renderAll();

    const link = document.createElement('a');
    link.download = `print_data_${selectedSize}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* サイドバー（操作パネル） */}
      <div style={{ width: '320px', backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#111827' }}>レトロチラシ作成ツール</h1>

        {/* 1. 用紙サイズ */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>1. 用紙サイズ</label>
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
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>2. 用紙カラー（プレビュー）</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {PAPER_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => handleColorChange(c.color)}
                style={{
                  width: '44px',
                  height: '44px',
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
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>3. 素材を追加</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={addText} style={btnStyle}>＋ テキストを追加</button>
            <button onClick={addRectangle} style={btnStyle}>＋ 四角枠線を追加</button>
            <button onClick={addCircle} style={btnStyle}>＋ 円枠線を追加</button>
            <label style={{ ...btnStyle, textAlign: 'center', cursor: 'pointer' }}>
              📷 画像を追加（モノクロ自動変換）
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* 削除・出力ボタン */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={deleteSelected} style={{ ...btnStyle, color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
            🗑 選択した要素を削除
          </button>
          <button onClick={exportForPrint} style={{ padding: '12px', backgroundColor: '#000000', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
            ⬇ 印刷用データ出力 (PNG)
          </button>
        </div>
      </div>

      {/* キャンバスエリア */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '20px', overflow: 'auto', justifyContent: 'center' }}>
        <div style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #d1d5db', lineHeight: 0 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '10px',
  fontSize: '13px',
  backgroundColor: '#f9fafb',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  cursor: 'pointer',
  textAlign: 'left',
};