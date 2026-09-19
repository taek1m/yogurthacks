import {
  Building2,
  CarFront,
  FileText,
  GraduationCap,
  House,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { DocumentType } from "@/types/agent";

export interface AgentIconStyle {
  icon: LucideIcon;
  objectClass: string;
  iconClass: string;
}

export const agentIconMap: Record<DocumentType, AgentIconStyle> = {
  auto_insurance: { icon: CarFront, objectClass: "bg-[#dcecff] border-[#8eacd0]", iconClass: "text-[#315f97]" },
  renters_insurance: { icon: ShieldCheck, objectClass: "bg-[#e4e1ff] border-[#aaa1d4]", iconClass: "text-[#5b5192]" },
  apartment_lease: { icon: House, objectClass: "bg-[#ffe2ca] border-[#d7a47c]", iconClass: "text-[#98552c]" },
  school_payment: { icon: GraduationCap, objectClass: "bg-[#fff2b8] border-[#d6ba55]", iconClass: "text-[#846615]" },
  bank: { icon: Landmark, objectClass: "bg-[#d5eee3] border-[#82b29c]", iconClass: "text-[#2d7153]" },
  general: { icon: FileText, objectClass: "bg-[#f2eee5] border-[#bcb4a4]", iconClass: "text-[#625d52]" },
};

export const createIcon = Building2;
