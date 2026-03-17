import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Button } from './components/ui/button'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './components/ui/select'
import { Search, ShoppingCart, User, CreditCard, Plus, Trash2 } from 'lucide-react'

// Types for Cart
interface LotteryItem {
  id: string; // Random UI ID
  packageId: string; // 福袋編號
  prizeStr: string; // 獎項
  draws: number; // 抽數
  action: "take" | "points"; // 帶走/點數
  packageName: string; // 套名
  price: number; // 單抽價
  prizeNo: string; // 獎項編號
  prizeName: string; // 獎項名稱
}

interface DirectPurchaseItem {
  id: string;
  itemNo: string; // 商品編號
  quantity: number; // 數量
  action: "take" | "points"; // 帶走/點數
  price: number; // 金額
  name: string; // 名稱
}

function App() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [member, setMember] = useState<{name: string, points: number, id: string} | null>(null)

  // Cart States
  const [lotteryItems, setLotteryItems] = useState<LotteryItem[]>([])
  const [directItems, setDirectItems] = useState<DirectPurchaseItem[]>([])

  const handleSearchMember = () => {
    // TODO: Connect to GAS API
    if (phoneNumber) {
      setMember({
        name: "Test User",
        points: 1200,
        id: "test-id"
      })
    }
  }

  const addLotteryItem = () => {
    setLotteryItems([...lotteryItems, {
      id: Math.random().toString(),
      packageId: '', prizeStr: '', draws: 1, action: 'take',
      packageName: '', price: 0, prizeNo: '', prizeName: ''
    }]);
  }

  const addDirectItem = () => {
    setDirectItems([...directItems, {
      id: Math.random().toString(),
      itemNo: '', quantity: 1, action: 'take', price: 0, name: ''
    }]);
  }

  const removeLotteryItem = (id: string) => {
    setLotteryItems(lotteryItems.filter(i => i.id !== id));
  }

  const removeDirectItem = (id: string) => {
    setDirectItems(directItems.filter(i => i.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 shrink-0 text-blue-600" />
          玩獸 POS 收銀系統
        </h1>
        <div className="text-sm text-gray-500">
          竹北店
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Member & Cart */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Member Search */}
          <Card>
            <CardHeader className="pb-3 text-left">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                會員資訊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2 text-left">
                  <label className="text-sm font-medium leading-none">輸入電話號碼</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="例如：0912345678" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchMember()}
                    />
                    <Button onClick={handleSearchMember}>
                      <Search className="w-4 h-4 mr-2" />
                      查詢
                    </Button>
                  </div>
                </div>
                
                {member && (
                  <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-blue-600 font-medium">會員姓名</div>
                      <div className="font-semibold text-gray-900">{member.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-blue-600 font-medium">目前點數</div>
                      <div className="font-bold text-xl text-blue-700">{member.points}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cart Area - Lottery */}
          <Card className="flex-1">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 text-left">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-6 bg-orange-500 rounded-sm"></span>
                福袋區
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addLotteryItem}>
                <Plus className="w-4 h-4 mr-1" /> 新增列
              </Button>
            </CardHeader>
            <CardContent>
              {lotteryItems.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50 border border-dashed rounded-lg">
                  尚無福袋購買項目
                </div>
              ) : (
                <div className="space-y-3">
                  {lotteryItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-left">
                      <Input placeholder="福袋編號" className="w-24" />
                      <Input placeholder="獎項" className="w-20" />
                      <Input type="number" placeholder="抽數" defaultValue={1} className="w-20" />
                      <Select defaultValue="take">
                        <SelectTrigger className="w-28 text-sm">
                          <SelectValue placeholder="帶走/點數" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="take">帶走</SelectItem>
                          <SelectItem value="points">點數</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1 px-3 py-2 text-sm bg-gray-50 rounded-md truncate">
                        (商品名稱與售價將自動帶入)
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeLotteryItem(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart Area - Direct Purchase */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 text-left">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-6 bg-red-500 rounded-sm"></span>
                直購區
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addDirectItem}>
                <Plus className="w-4 h-4 mr-1" /> 新增列
              </Button>
            </CardHeader>
            <CardContent>
              {directItems.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50 border border-dashed rounded-lg">
                  尚無直購商品項目
                </div>
              ) : (
                <div className="space-y-3">
                  {directItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-left">
                      <Input placeholder="商品編號" className="w-32" />
                      <Input type="number" placeholder="數量" defaultValue={1} className="w-24" />
                      <Select defaultValue="take">
                        <SelectTrigger className="w-28 text-sm">
                          <SelectValue placeholder="帶走/點數" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="take">結帳</SelectItem>
                          <SelectItem value="points">退貨/回點</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1 px-3 py-2 text-sm bg-gray-50 rounded-md truncate">
                        (商品名稱與售價將自動帶入)
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeDirectItem(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Payment & Summary */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <Card className="sticky top-24">
            <CardHeader className="pb-3 text-left">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                結帳資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">商品總計</span>
                  <span className="font-medium">$0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">點數總計 (帶走/新增點數)</span>
                  <span className="font-medium">+0 / -0</span>
                </div>
                <div className="pt-3 border-t flex justify-between items-center">
                  <span className="font-bold">應收金額</span>
                  <span className="text-2xl font-bold text-red-600">$0</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-4 pt-4 border-t text-left">
                <div className="space-y-2">
                  <label className="text-sm font-medium">點數折抵</label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">現金</label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">信用卡</label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">匯款</label>
                  <Input type="number" placeholder="0" />
                </div>
              </div>

              <Button className="w-full text-lg h-12 mt-4" size="lg">
                確認結帳
              </Button>

            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  )
}

export default App
