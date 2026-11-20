import React, { useMemo, useState } from 'react';
import { Phone, Plus } from 'lucide-react';
import { ContactModal } from '../components/modals/ContactModal';
import { useLedger } from '../context/LedgerContext';
import type { Contact, ContactType } from '../types/mizan';

export function ContactsView() {
  const { ledger } = useLedger();
  const contacts = ledger?.contacts ?? [];

  const [activeTab, setActiveTab] = useState<ContactType>('customer');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const customersCount = useMemo(
    () => contacts.filter((c) => c.type === 'customer').length,
    [contacts]
  );
  const suppliersCount = useMemo(
    () => contacts.filter((c) => c.type === 'supplier').length,
    [contacts]
  );

  const visibleContacts = useMemo(
    () => contacts.filter((c) => c.type === activeTab),
    [contacts, activeTab]
  );

  const openAdd = () => {
    setEditingContact(null);
    setModalOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">مخاطبین</h1>
          <p className="text-xs sm:text-sm text-[#6E5643] dark:text-[#B8A593]">
            مشتریان و تأمین‌کنندگان فروشگاه؛ برای ویرایش، روی هر کارت لمس کنید
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="min-h-[46px] px-5 rounded-2xl mizan-btn-primary text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>مخاطب جدید</span>
        </button>
      </header>

      {/* Two Tabs: Customer / Supplier */}
      <div
        role="tablist"
        aria-label="دسته مخاطبین"
        className="inline-flex gap-1.5 p-1.5 rounded-2xl mizan-segmented-glass"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'customer'}
          onClick={() => setActiveTab('customer')}
          className={`min-h-[40px] px-5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'customer'
              ? 'mizan-btn-primary'
              : 'text-[#544030] dark:text-[#D9C7B6] hover:bg-amber-900/8 dark:hover:bg-amber-400/10'
          }`}
        >
          مشتریان ({customersCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'supplier'}
          onClick={() => setActiveTab('supplier')}
          className={`min-h-[40px] px-5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'supplier'
              ? 'mizan-btn-primary'
              : 'text-[#544030] dark:text-[#D9C7B6] hover:bg-amber-900/8 dark:hover:bg-amber-400/10'
          }`}
        >
          تأمین‌کنندگان ({suppliersCount})
        </button>
      </div>

      {/* Contact Cards */}
      {visibleContacts.length === 0 ? (
        <section className="mizan-glass rounded-3xl p-8 text-center space-y-2">
          <p className="text-sm font-semibold">
            هنوز {activeTab === 'customer' ? 'مشتری' : 'تأمین‌کننده'}‌ای ثبت نشده است.
          </p>
          <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
            با دکمه «مخاطب جدید» اولین مورد را اضافه کنید.
          </p>
        </section>
      ) : (
        <section
          aria-label={activeTab === 'customer' ? 'فهرست مشتریان' : 'فهرست تأمین‌کنندگان'}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {visibleContacts.map((c) => {
            const initial = c.name.trim().charAt(0) || 'م';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openEdit(c)}
                aria-label={`ویرایش مخاطب ${c.name}`}
                className="mizan-glass hover:bg-white/90 dark:hover:bg-[#2A221A] rounded-3xl p-5 text-right flex items-start gap-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9A5B13] cursor-pointer"
              >
                <div
                  aria-hidden="true"
                  className="w-11 h-11 rounded-2xl bg-amber-500/18 dark:bg-amber-500/20 text-[#7F4A0E] dark:text-amber-300 font-extrabold text-base flex items-center justify-center shrink-0"
                >
                  {initial}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div>
                    <h2 className="text-base font-extrabold truncate">{c.name}</h2>
                    {c.handle && (
                      <p dir="ltr" className="text-xs text-[#6E5643] dark:text-[#B8A593] text-right truncate">
                        {c.handle}
                      </p>
                    )}
                  </div>

                  {c.phone && (
                    <p className="text-xs font-medium tabular-nums inline-flex items-center gap-1.5 text-[#544030] dark:text-[#D9C7B6]">
                      <Phone className="w-3.5 h-3.5 text-[#9A5B13] dark:text-amber-400" aria-hidden="true" />
                      <span dir="ltr">{c.phone}</span>
                    </p>
                  )}

                  {c.notes && (
                    <p className="text-xs text-[#6E5643] dark:text-[#B8A593] leading-relaxed line-clamp-2">
                      {c.notes}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </section>
      )}

      <ContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultType={activeTab}
        editingContact={editingContact}
      />
    </div>
  );
}
