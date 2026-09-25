/* Icon registry — data references icons by name, so an admin can pick an icon
   for a new category without a code change. */
import React from "react";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, ArrowUpDown, Baby, Banknote, BarChart3, Bell, BellOff,
  Bike, Bookmark, Boxes, Brush, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Clock, Cookie, CookingPot, Copy, CreditCard, CupSoda, Droplets, FileText, Filter, Gem, Headphones, Heart,
  History, Home, Info, Landmark, LayoutGrid, Leaf, LifeBuoy, Loader2, Lock, LogOut, Mail, MapPin, MessageCircle, Milk,
  Minus, Navigation, Package, PackageCheck, Palette, PartyPopper, PawPrint, PenLine, Pencil, Percent, Phone, Pill, Plus,
  RotateCcw, ScanLine, Search, Settings, Share2, Shield, ShieldCheck, Shirt, ShoppingBasket, ShoppingCart,
  SlidersHorizontal, Smartphone, Smile, Sparkles, SprayCan, Star, Stethoscope, Store, Sun, Tag, Trash2,
  TrendingUp, Truck, Upload, User, Users, Watch, Wheat, Wind, X, Syringe, BriefcaseMedical,
  LayoutDashboard, Menu, ArrowUpRight, ArrowDownRight, ChevronUp, MoreHorizontal, Image, ExternalLink, Download, Eye, Receipt, Megaphone, Wallet, LineChart, PackagePlus, PackageMinus, Calendar, Warehouse, Ban, Undo2,
} from "lucide-react";

export const ICONS = {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, ArrowUpDown, Baby, Banknote, BarChart3, Bell, BellOff,
  Bike, Bookmark, Boxes, Brush, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Clock, Cookie, CookingPot, Copy, CreditCard, CupSoda, Droplets, FileText, Filter, Gem, Headphones, Heart,
  History, Home, Info, Landmark, LayoutGrid, Leaf, LifeBuoy, Loader2, Lock, LogOut, Mail, MapPin, MessageCircle, Milk,
  Minus, Navigation, Package, PackageCheck, Palette, PartyPopper, PawPrint, PenLine, Pencil, Percent, Phone, Pill, Plus,
  RotateCcw, ScanLine, Search, Settings, Share2, Shield, ShieldCheck, Shirt, ShoppingBasket, ShoppingCart,
  SlidersHorizontal, Smartphone, Smile, Sparkles, SprayCan, Star, Stethoscope, Store, Sun, Tag, Trash2,
  TrendingUp, Truck, Upload, User, Users, Watch, Wheat, Wind, X, Syringe, BriefcaseMedical,
  LayoutDashboard, Menu, ArrowUpRight, ArrowDownRight, ChevronUp, MoreHorizontal, Image, ExternalLink, Download, Eye, Receipt, Megaphone, Wallet, LineChart, PackagePlus, PackageMinus, Calendar, Warehouse, Ban, Undo2,
};

export function Icon({ name, ...props }) {
  const Cmp = ICONS[name] || Package;
  return <Cmp {...props} />;
}
export const ICON_NAMES = Object.keys(ICONS);
export {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, ArrowUpDown, Baby, Banknote, BarChart3, Bell, BellOff,
  Bike, Bookmark, Boxes, Brush, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Clock, Cookie, CookingPot, Copy, CreditCard, CupSoda, Droplets, FileText, Filter, Gem, Headphones, Heart,
  History, Home, Info, Landmark, LayoutGrid, Leaf, LifeBuoy, Loader2, Lock, LogOut, Mail, MapPin, MessageCircle, Milk,
  Minus, Navigation, Package, PackageCheck, Palette, PartyPopper, PawPrint, PenLine, Pencil, Percent, Phone, Pill, Plus,
  RotateCcw, ScanLine, Search, Settings, Share2, Shield, ShieldCheck, Shirt, ShoppingBasket, ShoppingCart,
  SlidersHorizontal, Smartphone, Smile, Sparkles, SprayCan, Star, Stethoscope, Store, Sun, Tag, Trash2,
  TrendingUp, Truck, Upload, User, Users, Watch, Wheat, Wind, X, Syringe, BriefcaseMedical,
  LayoutDashboard, Menu, ArrowUpRight, ArrowDownRight, ChevronUp, MoreHorizontal, Image, ExternalLink, Download, Eye, Receipt, Megaphone, Wallet, LineChart, PackagePlus, PackageMinus, Calendar, Warehouse, Ban, Undo2,
};
