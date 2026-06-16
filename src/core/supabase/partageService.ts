/**
 * FAMILY OS — Service Partage Familial
 * Crée une liste partagée sur Supabase et synchronise en temps réel.
 */

import { supabase } from './client'
import { db } from '../db/database'
import { newEntity } from '../db/helpers'
import { v4 as uuid } from 'uuid'
import type { ListePartagee, ContactPartage, TypeListePartagee } from '../../shared/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemPartage {
  id: string
  label: string
  coche: boolean
  ordre: number
}

// ─── Générer un token URL-safe ────────────────────────────────────────────────

function genererToken(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

// ─── Créer une liste partagée ─────────────────────────────────────────────────

export async function creerListePartagee(
  titre: string,
  items: { label: string; ordre: number }[],
  contactId?: string,
  type: TypeListePartagee = 'preparation',
): Promise<{ token: string; url: string }> {
  const token = genererToken()

  // 1. Insérer les items dans Supabase
  const rows = items.map((item, i) => ({
    id: uuid(),
    liste_token: token,
    label: item.label,
    coche: false,
    ordre: item.ordre ?? i,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('listes_partagees_items').insert(rows)
  if (error) throw new Error(`Supabase insert error: ${error.message}`)

  // 2. Sauvegarder en local (Dexie)
  const base = window.location.origin + window.location.pathname
  const url = `${base}#/partage/${token}`

  const liste = newEntity<ListePartagee>({
    type,
    titre,
    contactId: contactId ?? undefined,
    tokenAcces: token,
    lienPublic: url,
    items: rows.map(r => ({
      id: r.id,
      texte: r.label,
      coche: false,
      cocheParContact: false,
      ordre: r.ordre,
    })),
    statut: 'active',
    archive: false,
  })
  await db.listesPartagees.add(liste)

  return { token, url }
}

// ─── Récupérer les items d'une liste depuis Supabase ─────────────────────────

export async function fetchItemsListe(token: string): Promise<ItemPartage[]> {
  const { data, error } = await supabase
    .from('listes_partagees_items')
    .select('id, label, coche, ordre')
    .eq('liste_token', token)
    .order('ordre')

  if (error) throw new Error(error.message)
  return (data ?? []) as ItemPartage[]
}

// ─── Cocher / décocher un item ────────────────────────────────────────────────

export async function cocherItem(itemId: string, coche: boolean): Promise<void> {
  const { error } = await supabase
    .from('listes_partagees_items')
    .update({ coche, updated_at: new Date().toISOString() })
    .eq('id', itemId)

  if (error) throw new Error(error.message)
}

// ─── Souscrire aux changements en temps réel ─────────────────────────────────

export function subscribeToListe(
  token: string,
  onChange: (items: ItemPartage[]) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`liste_${token}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'listes_partagees_items',
        filter: `liste_token=eq.${token}`,
      },
      async () => {
        const items = await fetchItemsListe(token)
        onChange(items)
      },
    )
    .subscribe()

  return channel
}

export function unsubscribe(channel: RealtimeChannel): void {
  supabase.removeChannel(channel)
}

// ─── Contacts CRUD ────────────────────────────────────────────────────────────

export async function getContacts(): Promise<ContactPartage[]> {
  return db.contactsPartage.filter(c => c.actif).toArray()
}

export async function creerContact(
  nom: string,
  methode: ContactPartage['methodeEnvoi'],
  telephone?: string,
  email?: string,
): Promise<string> {
  const contact = newEntity<ContactPartage>({
    nom,
    methodeEnvoi: methode,
    telephone,
    email,
    actif: true,
  })
  await db.contactsPartage.add(contact)
  return contact.id
}
