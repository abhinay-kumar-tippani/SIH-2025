import React from "react";
import { useI18n, Lang } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  className?: string;
}

export default function LanguageSwitcher({ className = "" }: Props) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={`fixed top-3 right-3 z-50 bg-white dark:bg-neutral-900 border rounded-md shadow-sm p-1 ${className}`}>
      <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t("lang_english") || "English"}</SelectItem>
          <SelectItem value="hi">{t("lang_hindi") || "हिंदी"}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
