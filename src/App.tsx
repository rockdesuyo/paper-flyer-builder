import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Type, Image as ImageIcon, Square, Circle, Download, Trash2 } from 'lucide-react';

// 用紙サイズの比率設定 (px換算)
const PAPER_SIZES = {
  A4: { width: 595, height: 842, label: 'A4' },
  A3: { width: 842, height: 1191, label: 'A3' },
  SQUARE: { width: 600, height: 600, label: 'スクエア' },
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

  // テキスト追加（黒固定）
  const addText = () => {
    if (!fabricCanvas) return;
    const text = new fabric.IText('ZUTOMAYO', {
      left: 100,
      top: 100,
      fontFamily: 'sans-serif',
      fontSize: 40,
      fontWeight: 'bold',
      fill: '#000000',
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  // 枠線（長方形）追加
  const addRectangle = () => {
    if (!fabricCanvas) return;
    const rect = new fabric.Rect({
      left: 50,
      top: 50,
      width: 200,
      height: 150,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 4,
    });
    fabricCanvas.add(rect);
  };

  // 円追加
  const addCircle = () => {
    if (!fabricCanvas) return;
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      radius: 60,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 4,
    });
    fabricCanvas.add(circle);
  };

  // 画像アップロード & モノクロ2値化（しきい値処理）
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgObj = new Image();
      imgObj.src = event.target?.result as string;
      imgObj.onload = () => {
        // 画像を白黒1bit（しきい値）変換するCanvas処理
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = imgObj.width;
        tempCanvas.height = imgObj.height;

        if (ctx) {
          ctx.drawImage(imgObj, 0, 0);
          const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          const data = imgData.data;

          // 輝度を計算して黒(#000000)と透明(#00000000)に分離
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const threshold = 128; // しきい値
            if (avg < threshold) {
              data[i] = 0;     // R
              data[i + 1] = 0; // G
              data[i + 2] = 0; // B
              data[i + 3] = 255; // 完全不透明（黒）
            } else {
              data[i + 3] = 0; // 完全透明
            }
          }
          ctx.putImageData(imgData, 0, 0);

          const fabricImg = new fabric.Image(tempCanvas, {
            left: 100,
            top: 100,
          });
          fabricImg.scaleToWidth(300);
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

  // 印刷用データ出力（背景透明・高解像度PNG）
  const exportForPrint = () => {
    if (!fabricCanvas) return;

    // 1. 背景色を一時的に透明にする
    fabricCanvas.backgroundColor = 'transparent';
    fabricCanvas.renderAll();

    // 2. 3倍スケール（約300dpi高解像度）でPNG出力
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      multiplier: 3,
    });

    // 3. 元の作業用背景色に戻す
    fabricCanvas.backgroundColor = paperColor;
    fabricCanvas.renderAll();

    // 4. ダウンロードリンクの発行
    const link = document.createElement('a');
    link.download = `print_data_${selectedSize}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* ツールバー */}
      <div className="w-80 bg-white border-r p-6 flex flex-col gap-6 shadow-sm overflow-y-auto">
        <h1 className="text-xl font-bold text-gray-800">レトロチラシ作成ツール</h1>

        {/* 1. サイズ選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">1. 用紙サイズ</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PAPER_SIZES) as Array<keyof typeof PAPER_SIZES>).map((sizeKey) => (
              <button
                key={sizeKey}
                onClick={() => setSelectedSize(sizeKey)}
                className={`py-2 text-sm rounded border ${
                  selectedSize === sizeKey
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {PAPER_SIZES[sizeKey].label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. 用紙カラー（プレビュー用） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">2. 用紙カラー（プレビュー）</label>
          <div className="grid grid-cols-4 gap-2">
            {PAPER_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => handleColorChange(c.color)}
                className="w-12 h-12 rounded-full border-2 border-gray-200 shadow-inner flex items-center justify-center transition-transform hover:scale-105"
                style={{ backgroundColor: c.color }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* 3. 素材追加 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">3. 素材を追加</label>
          <div className="flex flex-col gap-2">
            <button
              onClick={addText}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300"
            >
              <Type size={18} /> テキストを追加
            </button>
            <button
              onClick={addRectangle}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300"
            >
              <Square size={18} /> 四角枠線を追加
            </button>
            <button
              onClick={addCircle}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300"
            >
              <Circle size={18} /> 円枠線を追加
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300 cursor-pointer">
              <ImageIcon size={18} /> 画像を追加（モノクロ自動変換）
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* 編集・削除ボタン */}
        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={deleteSelected}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded border border-red-200"
          >
            <Trash2 size={18} /> 選択した要素を削除
          </button>
          <button
            onClick={exportForPrint}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-black text-white hover:bg-gray-800 rounded shadow font-bold"
          >
            <Download size={18} /> 印刷用データ出力 (PNG)
          </button>
        </div>
      </div>

      {/* エディタ領域 (Canvas) */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        <div className="border border-gray-300 shadow-2xl bg-white">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}