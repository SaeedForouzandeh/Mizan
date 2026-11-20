import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import type { Contact, ContactType } from '../../types/mizan';
import { ModalFrame } from './ModalFrame';

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  defaultType: ContactType;
  editingContact: Contact | null;
}

export function ContactModal({
  open,
  onClose,
  defaultType,
  editingContact,
}: ContactModalProps) {
  const { saveContact, deleteContact } = useLedger();

  const [type, setType] = useState<ContactType>(defaultType);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingContact) {
      setType(editingContact.type);
      setName(editingContact.name);
      setHandle(editingContact.handle);
      setPhone(editingContact.phone);
      setNotes(editingContact.notes);
    } else {
      setType(defaultType);
      setName('');
      setHandle('');
      setPhone('');
      setNotes('');
    }
  }, [open, editingContact, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('نام مخاطب الزامی است.');
      return;
    }
    setSaving(true);
    const res = await saveContact({
      id: editingContact?.id,
      type,
      name,
      handle,
      phone,
      notes,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'خطا در ذخیره مخاطب.');
      return;
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!editingContact) return;
    await deleteContact(editingContact.id);
    onClose();
  };

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      title={editingContact ? `ویرایش ${editingContact.name}` : 'افزودن مخاطب جدید'}
      subtitle="مشتریان و تأمین‌کنندگان فروشگاه"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div role="group" aria-label="نوع مخاطب" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('customer')}
            aria-pressed={type === 'customer'}
            className={`min-h-[42px] rounded-2xl text-sm font-semibold border transition-colors cursor-pointer ${
              type === 'customer'
                ? 'bg-[#9A5B13] text-white border-[#9A5B13]'
                : 'bg-white/70 dark:bg-[#1A1511] border-amber-900/15 dark:border-amber-200/15'
            }`}
          >
            مشتری
          </button>
          <button
            type="button"
            onClick={() => setType('supplier')}
            aria-pressed={type === 'supplier'}
            className={`min-h-[42px] rounded-2xl text-sm font-semibold border transition-colors cursor-pointer ${
              type === 'supplier'
                ? 'bg-[#9A5B13] text-white border-[#9A5B13]'
                : 'bg-white/70 dark:bg-[#1A1511] border-amber-900/15 dark:border-amber-200/15'
            }`}
          >
            تأمین‌کننده
          </button>
        </div>

        <div>
          <label htmlFor="contact-name" className="block text-xs font-semibold mb-1.5">
            نام و نام خانوادگی / عنوان <span className="text-red-600">*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً: مهسا کریمی"
            className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="contact-handle" className="block text-xs font-semibold mb-1.5">
              آیدی (اینستاگرام / تلگرام)
            </label>
            <input
              id="contact-handle"
              type="text"
              dir="ltr"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@username"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>

          <div>
            <label htmlFor="contact-phone" className="block text-xs font-semibold mb-1.5">
              شماره تلفن
            </label>
            <input
              id="contact-phone"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="contact-notes" className="block text-xs font-semibold mb-1.5">
            یادداشت
          </label>
          <textarea
            id="contact-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="سفارش‌های همیشگی، شرایط تسویه یا آدرس..."
            className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[46px] rounded-2xl mizan-btn-primary disabled:opacity-50 text-sm font-bold cursor-pointer"
          >
            {saving ? 'در حال ذخیره...' : editingContact ? 'ذخیره تغییرات' : 'افزودن مخاطب'}
          </button>

          {editingContact && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              aria-label={`حذف ${editingContact.name}`}
              className="min-w-[46px] min-h-[46px] rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </ModalFrame>
  );
}
