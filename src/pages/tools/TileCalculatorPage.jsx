import { useState } from 'react';
import { InputNumber, Select, Button, Card, Row, Col, Divider, Statistic } from 'antd';
import { CalculatorOutlined, ReloadOutlined } from '@ant-design/icons';

const TILE_SIZES = [
  { value: '600x600', label: '600×600mm (2×2 ft)', sqftPerTile: 3.87 },
  { value: '600x1200', label: '600×1200mm (2×4 ft)', sqftPerTile: 7.74 },
  { value: '800x800', label: '800×800mm (2.6×2.6 ft)', sqftPerTile: 6.89 },
  { value: '300x600', label: '300×600mm (1×2 ft)', sqftPerTile: 1.94 },
  { value: '300x300', label: '300×300mm (1×1 ft)', sqftPerTile: 0.97 },
  { value: '400x400', label: '400×400mm (1.3×1.3 ft)', sqftPerTile: 1.72 },
  { value: '200x300', label: '200×300mm', sqftPerTile: 0.65 },
  { value: '250x375', label: '250×375mm', sqftPerTile: 1.01 },
  { value: '800x1600', label: '800×1600mm (Slab)', sqftPerTile: 13.78 },
  { value: '1200x1200', label: '1200×1200mm (4×4 ft)', sqftPerTile: 15.5 },
  { value: '1200x1800', label: '1200×1800mm (4×6 ft)', sqftPerTile: 23.25 },
];

const TileCalculatorPage = () => {
  const [calcType, setCalcType] = useState('floor'); // floor / wall
  const [length, setLength] = useState(0);
  const [width, setWidth] = useState(0);
  const [wallHeight, setWallHeight] = useState(0);
  const [doors, setDoors] = useState(0);
  const [windows, setWindows] = useState(0);
  const [doorArea, setDoorArea] = useState(21); // avg 7x3 ft
  const [windowArea, setWindowArea] = useState(12); // avg 4x3 ft
  const [tileSize, setTileSize] = useState('600x600');
  const [piecesPerBox, setPiecesPerBox] = useState(4);
  const [wastage, setWastage] = useState(5);
  const [pricePerBox, setPricePerBox] = useState(0);
  const [result, setResult] = useState(null);

  const calculate = () => {
    let totalSqft = 0;
    if (calcType === 'floor') {
      totalSqft = length * width;
    } else {
      // Wall: perimeter × height - doors - windows
      const perimeter = 2 * (length + width);
      const wallArea = perimeter * wallHeight;
      const deductions = (doors * doorArea) + (windows * windowArea);
      totalSqft = Math.max(0, wallArea - deductions);
    }

    const selectedTile = TILE_SIZES.find(t => t.value === tileSize);
    const sqftPerTile = selectedTile?.sqftPerTile || 3.87;
    const sqftPerBox = sqftPerTile * piecesPerBox;

    const withWastage = totalSqft * (1 + wastage / 100);
    const tilesNeeded = Math.ceil(withWastage / sqftPerTile);
    const boxesNeeded = Math.ceil(tilesNeeded / piecesPerBox);
    const extraTiles = tilesNeeded - Math.ceil(totalSqft / sqftPerTile);
    const totalCost = boxesNeeded * pricePerBox;

    setResult({
      totalSqft: totalSqft.toFixed(1),
      withWastage: withWastage.toFixed(1),
      tilesNeeded,
      boxesNeeded,
      sqftPerBox: sqftPerBox.toFixed(2),
      extraTiles,
      totalCost: Math.round(totalCost),
    });
  };

  const reset = () => {
    setLength(0); setWidth(0); setWallHeight(0); setDoors(0); setWindows(0);
    setPricePerBox(0); setResult(null);
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Tile Calculator</h1>
        <p className="text-sm text-gray-500 mt-0.5">Calculate tiles, boxes, and cost for floor or wall tiling</p>
      </div>

      <Row gutter={24}>
        <Col span={14}>
          <Card>
            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="text-xs text-gray-500 block mb-2">Calculation Type</label>
                <div className="flex gap-2">
                  {[{ value: 'floor', label: 'Floor Tiling' }, { value: 'wall', label: 'Wall Tiling' }].map(t => (
                    <button key={t.value} className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${calcType === t.value ? 'bg-[#FF5F03] text-white border-[#FF5F03]' : 'text-gray-500 border-gray-200 bg-white hover:border-gray-300'}`}
                      onClick={() => setCalcType(t.value)}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Room Length (ft)</label>
                  <InputNumber min={0} value={length} onChange={v => setLength(v || 0)} className="w-full" size="large" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Room Width (ft)</label>
                  <InputNumber min={0} value={width} onChange={v => setWidth(v || 0)} className="w-full" size="large" />
                </div>
                {calcType === 'wall' && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Wall Height (ft)</label>
                    <InputNumber min={0} value={wallHeight} onChange={v => setWallHeight(v || 0)} className="w-full" size="large" />
                  </div>
                )}
              </div>

              {/* Deductions (wall) */}
              {calcType === 'wall' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Number of Doors</label>
                    <InputNumber min={0} value={doors} onChange={v => setDoors(v || 0)} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Number of Windows</label>
                    <InputNumber min={0} value={windows} onChange={v => setWindows(v || 0)} className="w-full" />
                  </div>
                </div>
              )}

              {/* Tile details */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tile Size</label>
                  <Select value={tileSize} onChange={setTileSize} className="w-full" size="large"
                    options={TILE_SIZES.map(t => ({ value: t.value, label: t.label }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Pieces per Box</label>
                  <InputNumber min={1} value={piecesPerBox} onChange={v => setPiecesPerBox(v || 4)} className="w-full" size="large" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Wastage %</label>
                  <InputNumber min={0} max={30} value={wastage} onChange={v => setWastage(v || 5)} className="w-full" size="large" suffix="%" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Price per Box ₹ (optional)</label>
                <InputNumber min={0} value={pricePerBox} onChange={v => setPricePerBox(v || 0)} className="w-48" size="large" prefix="₹" />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="primary" size="large" icon={<CalculatorOutlined />} onClick={calculate}>Calculate</Button>
                <Button size="large" icon={<ReloadOutlined />} onClick={reset}>Reset</Button>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={10}>
          {result ? (
            <Card title="Calculation Result" className="border-green-200 bg-green-50">
              <div className="space-y-3">
                <Row gutter={12}>
                  <Col span={12}><Statistic title="Total Area" value={`${result.totalSqft} sqft`} /></Col>
                  <Col span={12}><Statistic title="With Wastage" value={`${result.withWastage} sqft`} /></Col>
                </Row>
                <Divider className="my-2" />
                <Row gutter={12}>
                  <Col span={12}><Statistic title="Tiles Needed" value={result.tilesNeeded} suffix="pcs" valueStyle={{ color: '#1890ff' }} /></Col>
                  <Col span={12}><Statistic title="Boxes Needed" value={result.boxesNeeded} suffix="boxes" valueStyle={{ color: '#FF5F03', fontWeight: 'bold' }} /></Col>
                </Row>
                <Divider className="my-2" />
                <Row gutter={12}>
                  <Col span={12}><Statistic title="Sqft per Box" value={result.sqftPerBox} /></Col>
                  <Col span={12}><Statistic title="Extra Tiles (wastage)" value={result.extraTiles} suffix="pcs" valueStyle={{ color: '#fa8c16' }} /></Col>
                </Row>
                {result.totalCost > 0 && (
                  <>
                    <Divider className="my-2" />
                    <Statistic title="Estimated Cost" value={`₹${result.totalCost.toLocaleString()}`} valueStyle={{ color: '#52c41a', fontSize: '24px' }} />
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <CalculatorOutlined className="text-5xl text-gray-200" />
              <div className="text-gray-400 mt-4">Enter room dimensions and click Calculate</div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default TileCalculatorPage;
