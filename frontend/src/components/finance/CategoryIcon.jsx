import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Car,
  CircleDollarSign,
  Coffee,
  CreditCard,
  FileText,
  Film,
  Gamepad2,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Target,
  Wallet,
} from 'lucide-react'

// Nombres de ícono que envía el backend (`icon` en movimientos, cuentas y presupuestos).
const ICONS = {
  shopping: ShoppingCart,
  income: ArrowUpRight,
  expense: ArrowRightLeft,
  wallet: Wallet,
  car: Car,
  coffee: Coffee,
  briefcase: BriefcaseBusiness,
  home: Home,
  health: HeartPulse,
  gamepad: Gamepad2,
  film: Film,
  bank: Landmark,
  credit: CreditCard,
  piggy: PiggyBank,
  phone: Smartphone,
  cash: HandCoins,
  warning: AlertTriangle,
  bell: Bell,
  shield: ShieldCheck,
  chart: Activity,
  target: Target,
  dashboard: CircleDollarSign,
  search: Search,
  filter: SlidersHorizontal,
  report: FileText,
  transfer: ArrowRightLeft,
  deposit: CircleDollarSign,
}

/** `<CategoryIcon name="shopping" className="h-5 w-5" />` (ícono desconocido → billetera). */
export default function CategoryIcon({ name, className = 'h-5 w-5' }) {
  const Icon = ICONS[name] || Wallet
  return <Icon className={className} aria-hidden="true" />
}
