import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutShell } from './components/LayoutShell';
import { WelcomeScreen } from './components/WelcomeScreen';
import { BackupModal } from './components/modals/BackupModal';
import { ProductFormModal } from './components/modals/ProductFormModal';
import { RestockModal } from './components/modals/RestockModal';
import { SaleModal } from './components/modals/SaleModal';
import { LedgerProvider, useLedger } from './context/LedgerContext';
import type { NavTab, Product } from './types/mizan';
import { AnalyticsView } from './views/AnalyticsView';
import { ContactsView } from './views/ContactsView';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { SalesView } from './views/SalesView';

function MizanShell() {
  const { ready, isConfigured } = useLedger();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleDefaultProductId, setSaleDefaultProductId] = useState<string | undefined>(undefined);
  const [saleDefaultBatchId, setSaleDefaultBatchId] = useState<string | undefined>(undefined);
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockDefaultProductId, setRestockDefaultProductId] = useState<string | undefined>(undefined);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F0] dark:bg-[#14110E] text-[#261B12] dark:text-[#F5EFE6]">
        <div className="mizan-glass rounded-3xl px-6 py-4 text-sm font-semibold">
          در حال آماده‌سازی میزان...
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return <WelcomeScreen />;
  }

  const openSale = (productId?: string, batchId?: string) => {
    setSaleDefaultProductId(productId);
    setSaleDefaultBatchId(batchId);
    setSaleModalOpen(true);
  };

  const openRestock = (productId?: string) => {
    setRestockDefaultProductId(productId);
    setRestockModalOpen(true);
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  return (
    <>
      <LayoutShell
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBackup={() => setBackupModalOpen(true)}
      >
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenSale={openSale}
            onOpenRestock={openRestock}
            onOpenNewProduct={openNewProduct}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryView
            onOpenNewProduct={openNewProduct}
            onOpenEditProduct={openEditProduct}
            onOpenSale={openSale}
            onOpenRestock={openRestock}
          />
        )}
        {activeTab === 'sales' && <SalesView onOpenSale={() => openSale()} />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'contacts' && <ContactsView />}
      </LayoutShell>

      <SaleModal
        open={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        defaultProductId={saleDefaultProductId}
        defaultBatchId={saleDefaultBatchId}
      />

      <RestockModal
        open={restockModalOpen}
        onClose={() => setRestockModalOpen(false)}
        defaultProductId={restockDefaultProductId}
      />

      <ProductFormModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        editingProduct={editingProduct}
      />

      <BackupModal open={backupModalOpen} onClose={() => setBackupModalOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LedgerProvider>
        <MizanShell />
      </LedgerProvider>
    </ErrorBoundary>
  );
}
