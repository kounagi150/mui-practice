import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Alert from '@mui/material/Alert'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Chip from '@mui/material/Chip'
import CssBaseline from '@mui/material/CssBaseline'
import Dialog from '@mui/material/Dialog'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import Select from '@mui/material/Select'
import Snackbar from '@mui/material/Snackbar'
import Switch from '@mui/material/Switch'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'

type WishlistItem = {
  id: number
  name: string
  price: number
  url: string
  priority: string
  status: string
  category: string
}

// 一覧の表示確認用データ。価格・商品はサンプルです。
const initialWishlist: WishlistItem[] = [
  { id: 1, name: 'ワイヤレスヘッドホン', price: 15000, url: '', priority: '高', status: '未購入', category: '家電' },
  { id: 2, name: '読書用ライト', price: 3500, url: '', priority: '中', status: '検討中', category: '本' },
  { id: 3, name: '通学用リュック', price: 8000, url: '', priority: '低', status: '購入済み', category: 'その他' },
]

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })
const wishlistStorageKey = 'wishlist-items'
const budgetStorageKey = 'wishlist-budget'
const themeModeStorageKey = 'wishlist-theme-mode'
const csvHeaders = ['id', 'name', 'price', 'url', 'priority', 'status', 'category'] as const
const categories = ['その他', '家電', 'ゲーム', '本', '衣類', '趣味'] as const
const priorityOrder = { 高: 0, 中: 1, 低: 2 } as const
const priorityColors = { 高: 'error', 中: 'warning', 低: 'info' } as const

type SortOrder = 'registration' | 'price-ascending' | 'price-descending' | 'priority'
type ViewMode = 'card' | 'list'

const normalizeWishlistItem = (value: unknown): WishlistItem | null => {
  if (!value || typeof value !== 'object') return null

  const item = value as Partial<WishlistItem>
  if (!(
    typeof item.id === 'number' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    typeof item.url === 'string' &&
    typeof item.priority === 'string' &&
    typeof item.status === 'string'
  )) return null

  return { ...item, category: typeof item.category === 'string' ? item.category : '未分類' } as WishlistItem
}

const loadWishlist = (): WishlistItem[] => {
  try {
    const savedItems = localStorage.getItem(wishlistStorageKey)
    if (!savedItems) return initialWishlist

    const parsedItems: unknown = JSON.parse(savedItems)
    if (!Array.isArray(parsedItems)) return initialWishlist

    const normalizedItems = parsedItems.map(normalizeWishlistItem)
    return normalizedItems.every((item): item is WishlistItem => item !== null)
      ? normalizedItems
      : initialWishlist
  } catch {
    return initialWishlist
  }
}

const loadBudget = () => {
  try {
    return localStorage.getItem(budgetStorageKey) ?? ''
  } catch {
    return ''
  }
}

const loadThemeMode = (): PaletteMode => {
  try {
    return localStorage.getItem(themeModeStorageKey) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

const escapeCsvValue = (value: string | number) => {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const parseCsvLine = (line: string) => {
  const values: string[] = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (character === ',' && !inQuotes) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }

  if (inQuotes) throw new Error('CSVの引用符が閉じられていません。')
  values.push(value)
  return values
}

const parseWishlistCsv = (text: string): WishlistItem[] => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) throw new Error('CSVに商品データがありません。')

  const headers = parseCsvLine(lines[0])
  if (headers.length !== csvHeaders.length || headers.some((header, index) => header !== csvHeaders[index])) {
    throw new Error(`CSVの見出しは ${csvHeaders.join(',')} の順で指定してください。`)
  }

  const items = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line)
    if (values.length !== csvHeaders.length) {
      throw new Error(`${index + 2}行目の項目数が正しくありません。`)
    }

    const [id, name, price, url, priority, status, category] = values
    const item = normalizeWishlistItem({
      id: Number(id),
      name,
      price: Number(price),
      url,
      priority,
      status,
      category,
    })
    if (!item) throw new Error(`${index + 2}行目の商品データが正しくありません。`)
    if (!isOptionalHttpUrl(item.url)) throw new Error(`${index + 2}行目の商品URLが正しくありません。`)
    return item
  })

  return items
}

const isOptionalHttpUrl = (value: string) => {
  const url = value.trim()
  if (!url) return true

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:'
  } catch {
    return false
  }
}

function App() {
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [productCategory, setProductCategory] = useState('その他')
  const [priority, setPriority] = useState('中')
  const [wishlist, setWishlist] = useState(loadWishlist)
  const [budget, setBudget] = useState(loadBudget)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('すべて')
  const [highPriorityOnly, setHighPriorityOnly] = useState(false)
  const [hidePurchased, setHidePurchased] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('registration')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [formError, setFormError] = useState<string | null>(null)
  const [notification, setNotification] = useState('')
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<WishlistItem | null>(null)
  const [themeMode, setThemeMode] = useState<PaletteMode>(loadThemeMode)
  const importInputRef = useRef<HTMLInputElement>(null)
  const theme = useMemo(() => createTheme({
    palette: { mode: themeMode },
    typography: {
      fontFamily: "'DotGothic16', sans-serif",
    },
  }), [themeMode])

  useEffect(() => {
    try {
      localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlist))
    } catch {
      // ブラウザの保存領域が使えない場合も、画面上の操作は続けられるようにします。
    }
  }, [wishlist])

  useEffect(() => {
    try {
      localStorage.setItem(budgetStorageKey, budget)
    } catch {
      // 予算は画面上では継続して使えます。
    }
  }, [budget])

  useEffect(() => {
    try {
      localStorage.setItem(themeModeStorageKey, themeMode)
    } catch {
      // テーマ設定を保存できない場合も、現在の画面では切り替えを反映します。
    }
  }, [themeMode])

  const exportCsv = () => {
    const rows = wishlist.map((item) => csvHeaders.map((header) => escapeCsvValue(item[header])))
    const csv = [csvHeaders.join(','), ...rows.map((row) => row.join(','))].join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wishlist-items.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setNotification('CSVをエクスポートしました。')
  }

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const importedItems = parseWishlistCsv(await file.text())
      setWishlist(importedItems)
      setNotification(`${importedItems.length}件の商品をインポートしました。`)
    } catch (error) {
      setNotification(error instanceof Error ? `CSVを読み込めませんでした：${error.message}` : 'CSVを読み込めませんでした。')
    }
  }

  const addWishlistItem = () => {
    const name = productName.trim()
    const price = productPrice === '' ? 0 : Number(productPrice)
    if (!name) {
      setFormError('商品名を入力してください。')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError('値段は0以上の数値で入力してください。')
      return
    }
    if (!isOptionalHttpUrl(productUrl)) {
      setFormError('商品URLは https:// または http:// で始まるURLを入力してください。')
      return
    }

    setWishlist((items) => [
      ...items,
      { id: Date.now(), name, price, url: productUrl.trim(), priority, status: '未購入', category: productCategory },
    ])
    setFormError(null)
    setProductName('')
    setProductPrice('')
    setProductUrl('')
    setProductCategory('その他')
    setPriority('中')
    setNotification('商品を登録しました。')
  }

  const deleteWishlistItem = (id: number) => {
    setWishlist((items) => items.filter((item) => item.id !== id))
    setNotification('商品を削除しました。')
  }

  const updateWishlistItem = (updatedItem: WishlistItem) => {
    const name = updatedItem.name.trim()
    if (!name || !Number.isFinite(updatedItem.price) || updatedItem.price < 0) return

    setWishlist((items) => items.map((item) => (
      item.id === updatedItem.id
        ? { ...updatedItem, name, url: updatedItem.url.trim() }
        : item
    )))
    setEditingItem(null)
    setNotification('商品情報を更新しました。')
  }

  const updateStatus = (id: number, status: string) => {
    setWishlist((items) => items.map((item) => (
      item.id === id ? { ...item, status } : item
    )))
    setNotification('購入状況を更新しました。')
  }

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ja-JP')
  const filteredWishlist = wishlist.filter((item) => (
    item.name.toLocaleLowerCase('ja-JP').includes(normalizedQuery) &&
    (categoryFilter === 'すべて' || item.category === categoryFilter) &&
    (!highPriorityOnly || item.priority === '高') &&
    (!hidePurchased || item.status !== '購入済み')
  ))
  const displayedWishlist = [...filteredWishlist].sort((firstItem, secondItem) => {
    if (sortOrder === 'price-ascending') return firstItem.price - secondItem.price
    if (sortOrder === 'price-descending') return secondItem.price - firstItem.price
    if (sortOrder === 'priority') {
      const firstPriority = priorityOrder[firstItem.priority as keyof typeof priorityOrder] ?? 3
      const secondPriority = priorityOrder[secondItem.priority as keyof typeof priorityOrder] ?? 3
      return firstPriority - secondPriority
    }
    return 0
  })
  const budgetAmount = Math.max(0, Number(budget) || 0)
  const plannedTotal = wishlist
    .filter((item) => item.status !== '購入済み')
    .reduce((sum, item) => sum + item.price, 0)
  const budgetProgress = budgetAmount > 0 ? Math.min((plannedTotal / budgetAmount) * 100, 100) : 0
  const categorySummary = Array.from(new Set(wishlist.map((item) => item.category))).map((category) => {
    const items = wishlist.filter((item) => item.category === category)
    const total = items.reduce((sum, item) => sum + item.price, 0)
    return { category, count: items.length, total, average: total / items.length }
  })

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <main className={`min-h-screen px-4 py-6 sm:px-8 sm:py-10 ${themeMode === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">欲しいもの管理</h1>
          <Button variant="outlined" onClick={() => setThemeMode((mode) => mode === 'light' ? 'dark' : 'light')}>
            {themeMode === 'light' ? 'ダークテーマ' : 'ライトテーマ'}
          </Button>
        </div>
        <p className="mt-3 text-slate-600">欲しいものを一覧で確認できます。登録内容はこのブラウザに保存されます。</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outlined" onClick={exportCsv}>CSVをエクスポート</Button>
          <Button variant="outlined" onClick={() => importInputRef.current?.click()}>CSVをインポート</Button>
          <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
        </div>
        <section aria-labelledby="registration-heading" className="mt-8">
          <h2 id="registration-heading" className="mb-4 text-xl font-semibold">欲しいものを入力</h2>
          {formError && (
            <Alert severity="error" className="mb-4" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="product-name"
              label="商品名"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              fullWidth
              helperText="商品名を入力してください。"
            />
            <TextField
              id="product-price"
              label="値段"
              type="number"
              value={productPrice}
              onChange={(event) => setProductPrice(event.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              fullWidth
              helperText="未入力の場合は0円として登録します。"
            />
            <TextField
              id="product-url"
              label="商品URL"
              type="url"
              value={productUrl}
              onChange={(event) => setProductUrl(event.target.value)}
              fullWidth
              helperText="未入力でも登録できます。"
            />
            <div>
              <label htmlFor="product-category" className="mr-4 text-sm font-medium">カテゴリー</label>
              <Select native id="product-category" value={productCategory} onChange={(event) => setProductCategory(event.target.value)} inputProps={{ 'aria-label': 'カテゴリー' }}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="priority" className="mr-4 text-sm font-medium">優先度</label>
              <Select
                native
                id="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                inputProps={{ 'aria-label': '優先度' }}
              >
                <option value="高">高</option>
                <option value="中">中</option>
                <option value="低">低</option>
              </Select>
            </div>
            <Button
              variant="contained"
              onClick={addWishlistItem}
            >
              一覧に登録
            </Button>
          </div>
        </section>
        <section aria-labelledby="wishlist-heading" className="mt-10">
          <h2 id="wishlist-heading" className="text-xl font-semibold">欲しいもの一覧（{displayedWishlist.length}件／全{wishlist.length}件）</h2>
          <p className="mt-2 text-sm text-slate-500">表示確認用のサンプルです。商品・価格は実際の販売情報ではありません。</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="category-filter" className="mr-3 text-sm font-medium">分類</label>
              <Select native id="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} inputProps={{ 'aria-label': 'カテゴリーで絞り込み' }} size="small">
                <option value="すべて">すべて</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                <option value="未分類">未分類</option>
              </Select>
            </div>
            <div>
              <label htmlFor="sort-order" className="mr-3 text-sm font-medium">並べ替え</label>
              <Select
                native
                id="sort-order"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                inputProps={{ 'aria-label': '並べ替え' }}
                size="small"
              >
                <option value="registration">登録順</option>
                <option value="price-ascending">価格が低い順</option>
                <option value="price-descending">価格が高い順</option>
                <option value="priority">優先度順</option>
              </Select>
            </div>
            <div className="flex gap-2" aria-label="表示形式">
              <ToggleButton
                value="card"
                selected={viewMode === 'card'}
                onChange={() => setViewMode('card')}
                size="small"
              >
                カード表示
              </ToggleButton>
              <ToggleButton
                value="list"
                selected={viewMode === 'list'}
                onChange={() => setViewMode('list')}
                size="small"
              >
                リスト表示
              </ToggleButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <FormControlLabel control={<Checkbox checked={highPriorityOnly} onChange={(event) => setHighPriorityOnly(event.target.checked)} />} label="高優先度のみ" />
            <FormControlLabel control={<Switch checked={hidePurchased} onChange={(event) => setHidePurchased(event.target.checked)} />} label="購入済みを非表示" />
          </div>
          <TextField
            id="wishlist-search"
            label="商品名で検索"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            fullWidth
            className="mt-5"
          />
          <ul className={viewMode === 'card' ? 'mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'mt-5 space-y-3'}>
            {displayedWishlist.map((item) => (
              <li key={item.id}>
                <Card
                  variant="outlined"
                  sx={{ p: 3, height: '100%', borderRadius: 3 }}
                  className={viewMode === 'list' ? 'sm:flex sm:items-center sm:gap-6' : ''}
                >
                  <h3 className="text-lg font-semibold">{item.name}</h3>
                  <p className="mt-4 text-2xl font-bold">{yen.format(item.price)}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
                    <dt className="text-slate-500">分類</dt><dd>{item.category}</dd>
                    <dt className="text-slate-500">優先度</dt>
                    <dd>
                      <Chip
                        label={item.priority}
                        color={priorityColors[item.priority as keyof typeof priorityColors] ?? 'default'}
                        size="small"
                      />
                    </dd>
                    <dt className="text-slate-500"><label htmlFor={`status-${item.id}`}>購入状況</label></dt>
                    <dd>
                      <Select
                        native
                        id={`status-${item.id}`}
                        value={item.status}
                        onChange={(event) => updateStatus(item.id, event.target.value)}
                        inputProps={{ 'aria-label': `${item.name}の購入状況` }}
                        size="small"
                      >
                        <option value="未購入">未購入</option>
                        <option value="検討中">検討中</option>
                        <option value="購入済み">購入済み</option>
                      </Select>
                    </dd>
                    <dt className="text-slate-500">商品URL</dt>
                    <dd>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">商品を見る</a> : '未設定'}</dd>
                  </dl>
                  <Accordion disableGutters elevation={0} className="mt-4">
                    <AccordionSummary aria-controls={`details-${item.id}`} id={`details-header-${item.id}`}>
                      詳細を表示
                    </AccordionSummary>
                    <AccordionDetails id={`details-${item.id}`}>
                      <p className="text-sm text-slate-600">管理番号：{item.id}</p>
                      <p className="mt-2 text-sm text-slate-600">購入状況は上の選択欄から変更できます。</p>
                    </AccordionDetails>
                  </Accordion>
                  <div className="mt-6 flex gap-3">
                    <Button variant="outlined" onClick={() => setEditingItem(item)}>編集</Button>
                    <Button variant="outlined" color="error" onClick={() => setDeletingItem(item)}>削除</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {displayedWishlist.length === 0 && (
            <p className="mt-5 text-slate-600">一致する商品はありません。</p>
          )}
        </section>
        <section aria-labelledby="budget-heading" className="mt-10">
          <h2 id="budget-heading" className="text-xl font-semibold">予算管理</h2>
          <Card variant="outlined" sx={{ p: 3, mt: 2, borderRadius: 3 }}>
            <TextField
              id="budget"
              label="予算上限"
              type="number"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 200000, step: 1000 } }}
              helperText="0〜200,000円で入力します。"
              fullWidth
            />
            <p className="mt-5 text-sm">未購入・検討中の合計：{yen.format(plannedTotal)}</p>
            <p className="mt-2 text-sm">予算残額：{budgetAmount > 0 ? yen.format(budgetAmount - plannedTotal) : '予算を入力してください'}</p>
            <LinearProgress variant="determinate" value={budgetProgress} color={budgetAmount > 0 && plannedTotal > budgetAmount ? 'error' : 'primary'} aria-label="予算の使用率" className="mt-5" />
            <p className="mt-2 text-right text-sm">{budgetAmount > 0 ? `${Math.round((plannedTotal / budgetAmount) * 100)}%` : '0%'}</p>
          </Card>
        </section>
        <section aria-labelledby="comparison-heading" className="mt-10">
          <h2 id="comparison-heading" className="text-xl font-semibold">カテゴリー別の価格比較</h2>
          <Card variant="outlined" sx={{ mt: 2, borderRadius: 3, overflow: 'auto' }}>
            <Table aria-label="カテゴリー別の価格比較表">
              <TableHead>
                <TableRow>
                  <TableCell>カテゴリー</TableCell>
                  <TableCell align="right">件数</TableCell>
                  <TableCell align="right">合計金額</TableCell>
                  <TableCell align="right">平均金額</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categorySummary.map((summary) => (
                  <TableRow key={summary.category}>
                    <TableCell>{summary.category}</TableCell>
                    <TableCell align="right">{summary.count}</TableCell>
                    <TableCell align="right">{yen.format(summary.total)}</TableCell>
                    <TableCell align="right">{yen.format(summary.average)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
      <Dialog
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        aria-labelledby="edit-dialog-title"
        fullWidth
        maxWidth="sm"
      >
        {editingItem && (
          <div className="p-6">
            <h2 id="edit-dialog-title" className="text-xl font-bold">欲しいものを編集</h2>
            <TextField
              id="edit-name"
              label="商品名"
              value={editingItem.name}
              onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
              fullWidth
              className="mt-5"
            />
            <TextField
              id="edit-price"
              label="値段"
              type="number"
              value={editingItem.price}
              onChange={(event) => setEditingItem({
                ...editingItem,
                price: event.target.value === '' ? 0 : Number(event.target.value),
              })}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              fullWidth
              className="mt-4"
            />
            <TextField
              id="edit-url"
              label="商品URL"
              type="url"
              value={editingItem.url}
              onChange={(event) => setEditingItem({ ...editingItem, url: event.target.value })}
              fullWidth
              className="mt-4"
            />
            <div className="mt-4">
              <label htmlFor="edit-priority" className="mr-4 text-sm font-medium">優先度</label>
              <Select
                native
                id="edit-priority"
                value={editingItem.priority}
                onChange={(event) => setEditingItem({ ...editingItem, priority: event.target.value })}
                inputProps={{ 'aria-label': '優先度' }}
              >
                <option value="高">高</option>
                <option value="中">中</option>
                <option value="低">低</option>
              </Select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button onClick={() => setEditingItem(null)}>キャンセル</Button>
              <Button
                variant="contained"
                onClick={() => updateWishlistItem(editingItem)}
                disabled={!editingItem.name.trim() || !Number.isFinite(editingItem.price) || editingItem.price < 0}
              >
                保存
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        aria-labelledby="delete-dialog-title"
        role="alertdialog"
      >
        {deletingItem && (
          <div className="p-6">
            <h2 id="delete-dialog-title" className="text-xl font-bold">「{deletingItem.name}」を削除しますか？</h2>
            <p className="mt-3 text-slate-600">削除すると、このブラウザの保存データからも消えます。</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button onClick={() => setDeletingItem(null)}>キャンセル</Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  deleteWishlistItem(deletingItem.id)
                  setDeletingItem(null)
                }}
              >
                削除する
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Snackbar open={Boolean(notification)} autoHideDuration={3000} onClose={() => setNotification('')} message={notification} />
      </main>
    </ThemeProvider>
  )
}

export default App
