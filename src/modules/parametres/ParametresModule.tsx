/**
 * FAMILY OS — Module Paramètres
 * Membres, catégories, export/import
 */

import React, { useState, useEffect, useRef } from 'react';
import { usePersistedTab } from '../../shared/hooks/usePersistedTab';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SCHEMA_VERSION } from '../../core/db/database';
import { newEntity, withUpdate, softDeleteFields } from '../../core/db/helpers';
import { useSyncStatus } from '../../core/sync/useSyncStatus';
import { drainQueue, pullAll } from '../../core/sync/syncService';
import { getGeminiKey, setGeminiKey } from '../../core/ai/geminiService';
import { getOpenAIKey, setOpenAIKey } from '../../core/ai/openaiService';
import { ConfirmModal } from '../../shared/components/ui/ConfirmModal';
import { useHabitudesEditable } from '../../shared/hooks/useHabitudes';
import type { Membre, CategorieProduit, CategorieRecette, JourSemaineNum } from '@shared/types';

import './ParametresModule.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'membres' | 'categories' | 'habitudes' | 'donnees' | 'ia' | 'sync';

// ─── Section Membres ──────────────────────────────────────────────────────────

function MembreForm({
  editId,
  onClose,
}: {
  editId: string | null;
  onClose: () => void;
}) {
  const existing = useLiveQuery(
    () => (editId ? db.membres.get(editId) : undefined),
    [editId]
  );

  const [prenom, setPrenom] = useState('');
  const [couleur, setCouleur] = useState('#A78BFA');
  const [role, setRole] = useState<'parent' | 'enfant'>('parent');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setPrenom(existing.prenom);
    setCouleur(existing.couleur ?? '#A78BFA');
    setRole(existing.role);
  }, [existing?.id]);

  async function handleSave() {
    if (!prenom.trim()) return;
    setSaving(true);
    try {
      if (editId && existing) {
        await db.membres.update(editId, withUpdate<Membre>({ prenom: prenom.trim(), couleur, role }));
      } else {
        await db.membres.add(newEntity<Membre>({ prenom: prenom.trim(), couleur, role, actif: true }));
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActif() {
    if (!editId || !existing) return;
    await db.membres.update(editId, withUpdate<Membre>({ actif: !existing.actif }));
    onClose();
  }

  return (
    <div className="param-form">
      <h3 className="param-form__title">{editId ? 'Modifier le membre' : 'Nouveau membre'}</h3>

      <div className="param-form__field">
        <label>Prénom</label>
        <input className="param-form__input" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoFocus />
      </div>

      <div className="param-form__field">
        <label>Rôle</label>
        <div className="param-form__btns">
          {(['parent', 'enfant'] as const).map((r) => (
            <button
              key={r}
              className={`param-form__btn${role === r ? ' param-form__btn--active' : ''}`}
              onClick={() => setRole(r)}
            >
              {r === 'parent' ? '👨‍👩‍👧 Parent' : '🧒 Enfant'}
            </button>
          ))}
        </div>
      </div>

      <div className="param-form__field">
        <label>Couleur</label>
        <div className="param-form__color-row">
          {['#F9A8D4', '#86EFAC', '#93C5FD', '#FCD34D', '#A78BFA', '#FB923C', '#67E8F9'].map((c) => (
            <button
              key={c}
              className={`param-form__color-swatch${couleur === c ? ' param-form__color-swatch--active' : ''}`}
              style={{ background: c }}
              onClick={() => setCouleur(c)}
            />
          ))}
          <input type="color" className="param-form__color-input" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
        </div>
      </div>

      <div className="param-form__actions">
        {editId && existing && (
          <button className="param-form__btn-secondary" onClick={handleToggleActif}>
            {existing.actif ? 'Désactiver' : 'Réactiver'}
          </button>
        )}
        <button className="param-form__btn-cancel" onClick={onClose}>Annuler</button>
        <button className="param-form__btn-save" onClick={handleSave} disabled={saving || !prenom.trim()}>
          {saving ? '…' : editId ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}

function SectionMembres() {
  const membres = useLiveQuery(() => db.membres.toArray(), []) ?? [];
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const actifs = membres.filter((m) => m.actif);
  const inactifs = membres.filter((m) => !m.actif);

  function openEdit(id: string) {
    setEditId(id);
    setShowForm(true);
  }

  function openNew() {
    setEditId(null);
    setShowForm(true);
  }

  return (
    <div className="param-section">
      <div className="param-section__header">
        <h2 className="param-section__title">Membres</h2>
        <button className="param-add-btn" onClick={openNew}>+ Ajouter</button>
      </div>

      {showForm && (
        <div className="param-overlay" onClick={() => setShowForm(false)}>
          <div className="param-drawer" onClick={(e) => e.stopPropagation()}>
            <MembreForm editId={editId} onClose={() => setShowForm(false)} />
          </div>
        </div>
      )}

      <div className="param-list">
        {actifs.map((m) => (
          <div key={m.id} className="param-item" onClick={() => openEdit(m.id)}>
            <div className="param-item__avatar" style={{ background: m.couleur ?? '#E5E7EB' }}>
              {m.prenom[0]}
            </div>
            <div className="param-item__info">
              <span className="param-item__name">{m.prenom}</span>
              <span className="param-item__role">{m.role === 'parent' ? 'Parent' : 'Enfant'}</span>
            </div>
            <span className="param-item__chevron">›</span>
          </div>
        ))}
      </div>

      {inactifs.length > 0 && (
        <>
          <p className="param-section__subtitle">Inactifs</p>
          <div className="param-list param-list--muted">
            {inactifs.map((m) => (
              <div key={m.id} className="param-item param-item--inactive" onClick={() => openEdit(m.id)}>
                <div className="param-item__avatar" style={{ background: m.couleur ?? '#E5E7EB', opacity: 0.5 }}>
                  {m.prenom[0]}
                </div>
                <div className="param-item__info">
                  <span className="param-item__name">{m.prenom}</span>
                  <span className="param-item__role">{m.role === 'parent' ? 'Parent' : 'Enfant'} · inactif</span>
                </div>
                <span className="param-item__chevron">›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section Catégories ───────────────────────────────────────────────────────

function CatRow({
  nom,
  icone,
  onDelete,
}: {
  nom: string;
  icone?: string;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      <div className="param-item">
        {icone && <span className="param-item__icon">{icone}</span>}
        <span className="param-item__name" style={{ flex: 1 }}>{nom}</span>
        <button
          className="param-item__delete"
          onClick={() => setConfirmDelete(true)}
        >×</button>
      </div>
      <ConfirmModal
        open={confirmDelete}
        title={`Supprimer « ${nom} » ?`}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function SectionCategories() {
  const catsProduits = useLiveQuery(() => db.categoriesProduits.filter((c) => !c.deletedAt).sortBy('ordre'), [], []) as CategorieProduit[];
  const catsRecettes = useLiveQuery(() => db.categoriesRecettes.filter((c) => !c.deletedAt).sortBy('ordre'), [], []) as CategorieRecette[];

  const [newProduitNom, setNewProduitNom] = useState('');
  const [newProduitIcone, setNewProduitIcone] = useState('');
  const [newRecetteNom, setNewRecetteNom] = useState('');
  const [activePanel, setActivePanel] = useState<'produits' | 'recettes'>('produits');

  async function addCategorieProduit() {
    if (!newProduitNom.trim()) return;
    await db.categoriesProduits.add(newEntity<CategorieProduit>({
      nom: newProduitNom.trim(),
      icone: newProduitIcone.trim() || undefined,
      typeProduit: 'consommable',
      ordre: catsProduits.length,
      personnalisee: true,
    }));
    setNewProduitNom('');
    setNewProduitIcone('');
  }

  async function addCategorieRecette() {
    if (!newRecetteNom.trim()) return;
    await db.categoriesRecettes.add(newEntity<CategorieRecette>({
      nom: newRecetteNom.trim(),
      ordre: catsRecettes.length,
    }));
    setNewRecetteNom('');
  }

  async function deleteCatProduit(id: string) {
    await db.categoriesProduits.update(id, softDeleteFields());
  }

  async function deleteCatRecette(id: string) {
    await db.categoriesRecettes.update(id, softDeleteFields());
  }

  return (
    <div className="param-section">
      <div className="param-section__header">
        <h2 className="param-section__title">Catégories</h2>
      </div>
      <div className="param-tabs">
        <button className={`param-tab${activePanel === 'produits' ? ' param-tab--active' : ''}`} onClick={() => setActivePanel('produits')}>Produits</button>
        <button className={`param-tab${activePanel === 'recettes' ? ' param-tab--active' : ''}`} onClick={() => setActivePanel('recettes')}>Recettes</button>
      </div>

      {activePanel === 'produits' && (
        <>
          <div className="param-list">
            {catsProduits.map((c) => (
              <CatRow key={c.id} nom={c.nom} icone={c.icone} onDelete={() => deleteCatProduit(c.id)} />
            ))}
          </div>
          <div className="param-add-row">
            <input className="param-form__input param-add-row__icone" value={newProduitIcone} onChange={(e) => setNewProduitIcone(e.target.value)} placeholder="🫙" maxLength={4} />
            <input className="param-form__input param-add-row__nom" value={newProduitNom} onChange={(e) => setNewProduitNom(e.target.value)} placeholder="Nom de la catégorie" />
            <button className="param-add-btn" onClick={addCategorieProduit} disabled={!newProduitNom.trim()}>+</button>
          </div>
        </>
      )}

      {activePanel === 'recettes' && (
        <>
          <div className="param-list">
            {catsRecettes.map((c) => (
              <CatRow key={c.id} nom={c.nom} onDelete={() => deleteCatRecette(c.id)} />
            ))}
          </div>
          <div className="param-add-row">
            <input className="param-form__input param-add-row__nom" value={newRecetteNom} onChange={(e) => setNewRecetteNom(e.target.value)} placeholder="Nom de la catégorie" />
            <button className="param-add-btn" onClick={addCategorieRecette} disabled={!newRecetteNom.trim()}>+</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section Données (export / import) ───────────────────────────────────────

function SectionDonnees() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const data: Record<string, unknown> = {};
      const tables = [
        'taches', 'evenements', 'produits', 'wishlistItems', 'humeurs', 'notes',
        'enveloppes', 'transactions', 'membres', 'enfants', 'activites',
        'planificationsActivites', 'competences', 'competencesSuivi', 'elementsReligion',
        'recettes', 'recettesIngredients', 'menus', 'menuSlots', 'coursesItems',
        'pieces', 'projetsMaison', 'souvenirs', 'reunionsFamille', 'selfCareItems',
        'sportSessions', 'tags', 'categoriesProduits', 'categoriesRecettes',
        'categoriesActivites',
        'pensees', 'routines', 'routineItems', 'croissanceMesures', 'sessionsPreparation',
        'programmesPedagogiques', 'activitesProgramme', 'programmesAnnuels',
        'importsRecettesIA', 'contactsPartage', 'listesPartagees',
      ] as const;

      for (const table of tables) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data[table] = await (db as any)[table].toArray();
      }

      const snapshot = {
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      };

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `familyos-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem('family_os_last_export_reminder', String(Date.now()));
    } finally {
      setExporting(false);
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmImport(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function doImport() {
    if (!pendingFile) return;
    setImporting(true);
    setImportMsg('');
    try {
      const text = await pendingFile.text();
      let snapshot: { version?: number; data?: Record<string, unknown[]> };
      try {
        snapshot = JSON.parse(text);
      } catch {
        setImportMsg('❌ Fichier JSON invalide ou corrompu.');
        return;
      }
      if (!snapshot.data || typeof snapshot.data !== 'object') {
        setImportMsg('❌ Format de fichier non reconnu. Utilisez un export Family OS.');
        return;
      }
      if (snapshot.version && snapshot.version > SCHEMA_VERSION) {
        setImportMsg(`❌ Ce fichier vient d'une version plus récente (v${snapshot.version}). Mettez à jour l'application.`);
        return;
      }
      const { data } = snapshot;
      let count = 0;

      for (const [table, rows] of Object.entries(data)) {
        if (!Array.isArray(rows)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = (db as any)[table];
        if (!t) continue;
        await t.bulkPut(rows);
        count += rows.length;
      }

      setImportMsg(`✅ ${count} enregistrements importés avec succès.`);
    } catch {
      setImportMsg('❌ Erreur lors de l\'import. Vérifiez le fichier.');
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  }

  async function doClear() {
    const tables = [
      'taches', 'evenements', 'produits', 'wishlistItems', 'humeurs', 'notes',
      'enveloppes', 'transactions', 'membres', 'enfants', 'activites',
      'planificationsActivites', 'competences', 'competencesSuivi', 'elementsReligion',
      'recettes', 'recettesIngredients', 'menus', 'menuSlots', 'coursesItems',
      'pieces', 'projetsMaison', 'souvenirs', 'reunionsFamille', 'selfCareItems',
      'sportSessions', 'tags', 'categoriesProduits', 'categoriesRecettes',
      'categoriesActivites',
      'pensees', 'routines', 'routineItems', 'croissanceMesures', 'sessionsPreparation',
    ] as const;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Promise.all(tables.map((t) => (db as any)[t].clear()));
    setImportMsg('Données effacées. Rechargez la page pour réinitialiser.');
  }

  return (
    <>
    <div className="param-section">
      <h2 className="param-section__title">Données</h2>

      <div className="param-card">
        <p className="param-card__title">Exporter</p>
        <p className="param-card__desc">Télécharge un fichier JSON avec toutes vos données.</p>
        <button className="param-btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Export en cours…' : '⬇ Exporter mes données'}
        </button>
      </div>

      <div className="param-card">
        <p className="param-card__title">Importer</p>
        <p className="param-card__desc">Restaure depuis un fichier JSON exporté précédemment.</p>
        <button className="param-btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? 'Import en cours…' : '⬆ Importer un fichier'}
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {importMsg && <p className="param-card__msg">{importMsg}</p>}
      </div>

      <div className="param-card param-card--danger">
        <p className="param-card__title">Zone de danger</p>
        <p className="param-card__desc">Efface toutes les données locales. Irréversible.</p>
        <button className="param-btn-danger" onClick={() => setConfirmClear(true)}>Effacer toutes les données</button>
      </div>
    </div>

    <ConfirmModal
      open={confirmImport}
      title="Importer ces données ?"
      message="Cela remplacera les données existantes dans chaque table. Cette action ne peut pas être annulée."
      confirmLabel="Importer"
      onConfirm={() => { setConfirmImport(false); doImport(); }}
      onCancel={() => { setConfirmImport(false); setPendingFile(null); }}
    />

    <ConfirmModal
      open={confirmClear}
      title="Effacer toutes les données ?"
      message="Cette action est irréversible. Toutes vos données locales seront définitivement supprimées."
      confirmLabel="Tout effacer"
      danger
      onConfirm={() => { setConfirmClear(false); doClear(); }}
      onCancel={() => setConfirmClear(false)}
    />
    </>
  );
}

// ─── Section Habitudes ────────────────────────────────────────────────────────

const JOURS_LABELS: { value: JourSemaineNum; label: string }[] = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' }, { value: 5, label: 'Ven' }, { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
]

function JourPicker({
  label, value, onChange,
}: { label: string; value?: JourSemaineNum; onChange: (j: JourSemaineNum) => void }) {
  return (
    <div className="param-field">
      <label className="param-label">{label}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {JOURS_LABELS.map(({ value: v, label: l }) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              background: value === v ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.05)',
              color: value === v ? '#7C3AED' : '#6B7280',
              outline: value === v ? '1.5px solid rgba(124,58,237,0.4)' : 'none',
            }}
          >{l}</button>
        ))}
      </div>
    </div>
  )
}

function JoursMultiPicker({
  label, values, onChange,
}: { label: string; values?: JourSemaineNum[]; onChange: (jours: JourSemaineNum[]) => void }) {
  const sel = values ?? []
  const toggle = (j: JourSemaineNum) =>
    onChange(sel.includes(j) ? sel.filter(x => x !== j) : [...sel, j])
  return (
    <div className="param-field">
      <label className="param-label">{label}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {JOURS_LABELS.map(({ value: v, label: l }) => (
          <button
            key={v}
            onClick={() => toggle(v)}
            style={{
              padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              background: sel.includes(v) ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.05)',
              color: sel.includes(v) ? '#7C3AED' : '#6B7280',
              outline: sel.includes(v) ? '1.5px solid rgba(124,58,237,0.4)' : 'none',
            }}
          >{l}</button>
        ))}
      </div>
    </div>
  )
}

function SelectField<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value?: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="param-field">
      <label className="param-label">{label}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              background: value === o.value ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.05)',
              color: value === o.value ? '#7C3AED' : '#6B7280',
              outline: value === o.value ? '1.5px solid rgba(124,58,237,0.4)' : 'none',
            }}
          >{o.label}</button>
        ))}
      </div>
    </div>
  )
}

function SectionHabitudes() {
  const { habitudes, save } = useHabitudesEditable()
  const [saved, setSaved] = useState(false)

  async function handleSave(patch: Parameters<typeof save>[0]) {
    await save(patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="param-section">
      <h2 className="param-section__title">Mes habitudes</h2>
      <p className="param-section-desc" style={{ marginBottom: 20, fontSize: '0.85rem', color: '#9B8DB5' }}>
        Ces informations permettent à l'app d'anticiper tes besoins et d'afficher les bonnes actions au bon moment.
      </p>

      {/* Rythme semaine */}
      <p className="param-section__subtitle">Rythme de la semaine</p>

      <JourPicker
        label="Jour habituel des courses"
        value={habitudes.jourCourses}
        onChange={v => handleSave({ jourCourses: v })}
      />

      <JourPicker
        label="Jour de batch cooking"
        value={habitudes.jourBatchCooking}
        onChange={v => handleSave({ jourBatchCooking: v })}
      />

      <JoursMultiPicker
        label="Jours de télétravail"
        values={habitudes.joursTeletravail}
        onChange={v => handleSave({ joursTeletravail: v })}
      />

      {/* Menus */}
      <p className="param-section__subtitle" style={{ marginTop: 20 }}>Menus</p>

      <SelectField
        label="Fréquence de renouvellement des menus"
        value={habitudes.frequenceRenouvellementMenus}
        options={[
          { value: 'hebdomadaire',   label: 'Chaque semaine' },
          { value: 'bihebdomadaire', label: 'Toutes les 2 semaines' },
        ]}
        onChange={v => handleSave({ frequenceRenouvellementMenus: v })}
      />

      {/* Ménage */}
      <p className="param-section__subtitle" style={{ marginTop: 20 }}>Ménage</p>

      <SelectField
        label="Fréquence aspirateur / sols"
        value={habitudes.frequenceAspirateur}
        options={[
          { value: 'quotidienne',    label: 'Tous les jours' },
          { value: 'bihebdomadaire', label: '2× par semaine' },
          { value: 'hebdomadaire',   label: '1× par semaine' },
          { value: 'bimensuelle',    label: '2× par mois' },
        ]}
        onChange={v => handleSave({ frequenceAspirateur: v })}
      />

      <SelectField
        label="Fréquence linge"
        value={habitudes.frequenceLinge}
        options={[
          { value: 'quotidienne',    label: 'Tous les jours' },
          { value: 'bihebdomadaire', label: '2× par semaine' },
          { value: 'hebdomadaire',   label: '1× par semaine' },
          { value: 'bimensuelle',    label: '2× par mois' },
        ]}
        onChange={v => handleSave({ frequenceLinge: v })}
      />

      {/* Routines */}
      <p className="param-section__subtitle" style={{ marginTop: 20 }}>Routines</p>

      <div className="param-field">
        <label className="param-label">Heure de réveil</label>
        <input
          type="time"
          className="param-input"
          style={{ maxWidth: 120 }}
          value={habitudes.heureReveil ?? ''}
          onChange={e => handleSave({ heureReveil: e.target.value })}
        />
      </div>

      <div className="param-field">
        <label className="param-label">Heure de coucher</label>
        <input
          type="time"
          className="param-input"
          style={{ maxWidth: 120 }}
          value={habitudes.heureCoucher ?? ''}
          onChange={e => handleSave({ heureCoucher: e.target.value })}
        />
      </div>

      {saved && (
        <p style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 10,
          background: 'rgba(52,211,153,0.12)', color: '#065F46',
          fontSize: '0.83rem', fontWeight: 500,
        }}>
          ✓ Habitudes enregistrées
        </p>
      )}
    </div>
  )
}

// ─── Section IA ───────────────────────────────────────────────────────────────

function CleAPIField({
  label, hint, hintUrl, hintUrlLabel, placeholder,
  value, onChange, onSave, saved,
}: {
  label: string; hint: string; hintUrl: string; hintUrlLabel: string;
  placeholder: string; value: string;
  onChange: (v: string) => void; onSave: () => void; saved: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="param-field">
      <label className="param-label">{label}</label>
      <div className="param-ia-row">
        <input
          className="param-input"
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="param-btn param-btn--secondary" onClick={() => setVisible(v => !v)} type="button">
          {visible ? 'Masquer' : 'Voir'}
        </button>
      </div>
      <p className="param-hint">
        {hint}{' '}
        <a href={hintUrl} target="_blank" rel="noopener noreferrer">{hintUrlLabel}</a>
      </p>
      <button
        className={`param-btn param-btn--primary${saved ? ' param-btn--saved' : ''}`}
        onClick={onSave}
        disabled={!value.trim()}
        style={{ marginTop: 10 }}
      >
        {saved ? '✓ Enregistrée' : 'Enregistrer'}
      </button>
      {value && (
        <div className="param-ia-status" style={{ marginTop: 10 }}>
          <span className="param-ia-status__dot" />
          Clé configurée
        </div>
      )}
    </div>
  );
}

function SectionIA() {
  const [geminiKey,  setGeminiKeyState]  = useState(getGeminiKey);
  const [openaiKey,  setOpenAIKeyState]  = useState(getOpenAIKey);
  const [savedGemini, setSavedGemini]    = useState(false);
  const [savedOpenAI, setSavedOpenAI]    = useState(false);

  const saveGemini = () => { setGeminiKey(geminiKey); setSavedGemini(true); setTimeout(() => setSavedGemini(false), 2500); };
  const saveOpenAI = () => { setOpenAIKey(openaiKey); setSavedOpenAI(true); setTimeout(() => setSavedOpenAI(false), 2500); };

  return (
    <div className="param-section">
      <h2 className="param-section-title">Intelligence artificielle</h2>

      {/* ── OpenAI — génération de menus ── */}
      <p className="param-section-desc">
        La clé <strong>OpenAI</strong> active la génération automatique de menus (GPT-4o-mini).
        Coût estimé : moins de 0,10 € par mois.
      </p>
      <CleAPIField
        label="Clé API OpenAI"
        hint="Obtiens ta clé sur"
        hintUrl="https://platform.openai.com/api-keys"
        hintUrlLabel="platform.openai.com"
        placeholder="sk-proj-…"
        value={openaiKey}
        onChange={setOpenAIKeyState}
        onSave={saveOpenAI}
        saved={savedOpenAI}
      />

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid rgba(167,139,250,0.15)' }} />

      {/* ── Gemini — classification des pensées ── */}
      <p className="param-section-desc">
        La clé <strong>Gemini</strong> (Google, gratuite) améliore l'interprétation automatique
        de tes pensées dans le héro. Optionnelle — un système local fonctionne sans clé.
      </p>
      <CleAPIField
        label="Clé API Gemini (optionnelle)"
        hint="Clé gratuite sur"
        hintUrl="https://aistudio.google.com/app/apikey"
        hintUrlLabel="aistudio.google.com"
        placeholder="AIza…"
        value={geminiKey}
        onChange={setGeminiKeyState}
        onSave={saveGemini}
        saved={savedGemini}
      />
    </div>
  );
}

// ─── ParametresModule ─────────────────────────────────────────────────────────

// ─── Section Synchronisation ──────────────────────────────────────────────────

function SectionSync() {
  const { state, lastPullAt, pendingCount, lastError, isOnline } = useSyncStatus()
  const [syncing, setSyncing] = useState(false)
  const [done, setDone] = useState(false)

  async function forceSync() {
    if (syncing) return
    setSyncing(true)
    setDone(false)
    try {
      await drainQueue()
      await pullAll()
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const STATE_LABEL: Record<string, string> = {
    synced:  'Synchronisé',
    pending: 'En attente',
    syncing: 'Synchronisation…',
    error:   'Erreur',
    offline: 'Hors ligne',
  }
  const STATE_COLOR: Record<string, string> = {
    synced:  '#22c55e',
    pending: '#f59e0b',
    syncing: '#a78bfa',
    error:   '#ef4444',
    offline: '#9ca3af',
  }

  function formatDate(d: Date | null) {
    if (!d) return '—'
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60)   return `il y a ${diff}s`
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="param-section">
      <h2 className="param-section__title">Synchronisation</h2>

      {/* Statut global */}
      <div className="sync-status-card">
        <div className="sync-status-card__row">
          <span className="sync-status-card__label">État</span>
          <span className="sync-status-card__value" style={{ color: STATE_COLOR[state], fontWeight: 600 }}>
            <span className="sync-dot" style={{ background: STATE_COLOR[state] }} />
            {STATE_LABEL[state]}
          </span>
        </div>
        <div className="sync-status-card__row">
          <span className="sync-status-card__label">Connexion</span>
          <span className="sync-status-card__value">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
        </div>
        <div className="sync-status-card__row">
          <span className="sync-status-card__label">Dernière sync</span>
          <span className="sync-status-card__value">{formatDate(lastPullAt)}</span>
        </div>
        <div className="sync-status-card__row">
          <span className="sync-status-card__label">En attente</span>
          <span className="sync-status-card__value" style={{ color: pendingCount > 0 ? '#f59e0b' : undefined }}>
            {pendingCount > 0 ? `${pendingCount} élément${pendingCount > 1 ? 's' : ''}` : 'Aucun'}
          </span>
        </div>
        {lastError && (
          <div className="sync-status-card__row sync-status-card__row--error">
            <span className="sync-status-card__label">Dernière erreur</span>
            <span className="sync-status-card__value sync-status-card__error">{lastError}</span>
          </div>
        )}
      </div>

      {/* Bouton forcer */}
      <button
        className="param-btn param-btn--primary"
        onClick={forceSync}
        disabled={syncing || !isOnline}
        style={{ marginTop: 16 }}
      >
        {syncing ? 'Synchronisation en cours…' : done ? '✓ Synchronisé' : '↻ Forcer la synchronisation'}
      </button>
      {!isOnline && (
        <p className="param-hint" style={{ marginTop: 8 }}>
          Synchronisation impossible hors ligne. Les données seront envoyées au retour de la connexion.
        </p>
      )}

      {/* Explication */}
      <div className="sync-info-box">
        <p className="sync-info-box__text">
          La synchronisation est automatique : chaque modification est envoyée vers le cloud dès l'enregistrement.
          En cas d'erreur réseau, les éléments sont mis en file d'attente et rejoués automatiquement au retour de la connexion.
          Un pull complet se déclenche également toutes les 5 minutes.
        </p>
      </div>
    </div>
  )
}

export default function ParametresModule() {
  const [tab, setTab] = usePersistedTab<Tab>('parametres', 'membres');

  return (
    <div className="param-module">
      <div className="param-header">
        <h1 className="param-title">Paramètres</h1>
      </div>

      <div className="param-tabs">
        <button className={`param-tab${tab === 'membres' ? ' param-tab--active' : ''}`} onClick={() => setTab('membres')}>Membres</button>
        <button className={`param-tab${tab === 'categories' ? ' param-tab--active' : ''}`} onClick={() => setTab('categories')}>Catégories</button>
        <button className={`param-tab${tab === 'habitudes' ? ' param-tab--active' : ''}`} onClick={() => setTab('habitudes')}>Habitudes</button>
        <button className={`param-tab${tab === 'donnees' ? ' param-tab--active' : ''}`} onClick={() => setTab('donnees')}>Données</button>
        <button className={`param-tab${tab === 'ia' ? ' param-tab--active' : ''}`} onClick={() => setTab('ia')}>IA ✦</button>
        <button className={`param-tab${tab === 'sync' ? ' param-tab--active' : ''}`} onClick={() => setTab('sync')}>Sync</button>
      </div>

      {tab === 'membres'    && <SectionMembres />}
      {tab === 'categories' && <SectionCategories />}
      {tab === 'habitudes'  && <SectionHabitudes />}
      {tab === 'donnees'    && <SectionDonnees />}
      {tab === 'ia'         && <SectionIA />}
      {tab === 'sync'       && <SectionSync />}
    </div>
  );
}
