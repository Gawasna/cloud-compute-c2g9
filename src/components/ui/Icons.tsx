import React from 'react';
import {
  LayoutDashboard,
  Package,
  Archive,
  Boxes,
  ArrowLeftRight,
  History,
  FileBarChart,
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  RotateCcw,
  Download,
  X,
  ExternalLink,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Bell,
  Flag,
  Tv,
  Home,
  Shirt,
  Folder,
  Eye,
  EyeOff,
  Globe,
  ChevronDown,
  LogOut,
  Image as LucideImage,
  type LucideProps,
} from 'lucide-react';
import { ICON_DEFAULTS } from '@/lib/theme/tokens';

export interface IconProps extends LucideProps {
  className?: string;
}

function createIcon(IconComponent: React.ComponentType<LucideProps>) {
  const WrappedIcon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => {
    const {
      size = ICON_DEFAULTS.size,
      strokeWidth = ICON_DEFAULTS.strokeWidth,
      className,
      'aria-hidden': ariaHidden = true,
      ...rest
    } = props;

    return (
      <IconComponent
        ref={ref}
        size={size}
        strokeWidth={strokeWidth}
        className={className}
        aria-hidden={ariaHidden}
        {...rest}
      />
    );
  });
  WrappedIcon.displayName = `Icon(${IconComponent.displayName || IconComponent.name || 'Component'})`;
  return WrappedIcon;
}

// Navigation Icons
export const LayoutDashboardIcon = createIcon(LayoutDashboard);
export const OverviewIcon = LayoutDashboardIcon;
export const PackageIcon = createIcon(Package);
export const ProductsIcon = PackageIcon;
export const ArchiveIcon = createIcon(Archive);
export const BoxesIcon = createIcon(Boxes);
export const BrandIcon = BoxesIcon;
export const ArrowLeftRightIcon = createIcon(ArrowLeftRight);
export const StockMovementIcon = ArrowLeftRightIcon;
export const HistoryIcon = createIcon(History);
export const TransactionsIcon = HistoryIcon;
export const FileBarChartIcon = createIcon(FileBarChart);
export const ReportsIcon = FileBarChartIcon;
export const UsersIcon = createIcon(Users);

// Action Icons
export const SearchIcon = createIcon(Search);
export const PlusIcon = createIcon(Plus);
export const EditIcon = createIcon(Edit);
export const Trash2Icon = createIcon(Trash2);
export const TrashIcon = Trash2Icon;
export const RotateCcwIcon = createIcon(RotateCcw);
export const DownloadIcon = createIcon(Download);
export const XIcon = createIcon(X);
export const CloseIcon = XIcon;
export const ExternalLinkIcon = createIcon(ExternalLink);
export const ArrowRightIcon = createIcon(ArrowRight);
export const CheckIcon = createIcon(Check);
export const EyeIcon = createIcon(Eye);
export const EyeOffIcon = createIcon(EyeOff);
export const GlobeIcon = createIcon(Globe);
export const ChevronDownIcon = createIcon(ChevronDown);
export const LogOutIcon = createIcon(LogOut);
export const ImageIcon = createIcon(LucideImage);

// Status & Feedback Icons
export const CheckCircle2Icon = createIcon(CheckCircle2);
export const AlertTriangleIcon = createIcon(AlertTriangle);
export const BanIcon = createIcon(Ban);
export const BellIcon = createIcon(Bell);
export const FlagIcon = createIcon(Flag);

// Category Icons
export const TvIcon = createIcon(Tv);
export const HomeIcon = createIcon(Home);
export const ShirtIcon = createIcon(Shirt);
export const FolderIcon = createIcon(Folder);

/**
 * Maps category name strings to corresponding SVG Icon component
 */
export function getCategoryIconComponent(category: string = ''): React.ComponentType<IconProps> {
  const c = category.toLowerCase().trim();
  if (c.includes('electronics') || c.includes('điện tử')) {
    return TvIcon;
  }
  if (c.includes('home') || c.includes('gia dụng')) {
    return HomeIcon;
  }
  if (c.includes('fashion') || c.includes('thời trang') || c.includes('apparel')) {
    return ShirtIcon;
  }
  return FolderIcon;
}

export function renderCategoryIcon(category: string = '', props?: IconProps): React.ReactElement {
  const Icon = getCategoryIconComponent(category);
  return <Icon {...props} />;
}
