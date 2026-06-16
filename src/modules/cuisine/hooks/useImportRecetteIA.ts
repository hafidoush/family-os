/**
 * FAMILY OS — Hook Import Recettes IA
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useCallback } from 'react'
import { db } from '../../../core/db/database'
import {
  importerDepuisTexte,
  importerDepuisURL,
  importerDepuisImage,
  validerEtSauvegarder,
  reessayerImport,
  archiverImport,
} from '../services/importRecetteIAService'
import type { RecetteExtractee } from '../../../shared/types'
import type { RecetteValideeFormData } from '../services/importRecetteIAService'

// ─── Historique des imports ────────────────────────────────────────────────────

export function useHistoriqueImports() {
  return useLiveQuery(
    () => db.importsRecettesIA
      .filter(i => !i.archive)
      .reverse()
      .sortBy('createdAt'),
    [],
    []
  )
}

export function useImportRecette(importId: string | null) {
  return useLiveQuery(
    () => importId ? db.importsRecettesIA.get(importId) : undefined,
    [importId]
  )
}

// ─── Hook workflow d'import ───────────────────────────────────────────────────

export type EtapeImport =
  | 'saisie'          // formulaire initial
  | 'extraction'      // IA en cours
  | 'validation'      // parent valide / corrige
  | 'sauvegarde'      // enregistrement final
  | 'succes'          // terminé
  | 'erreur'          // échec extraction

export interface EtatImport {
  etape: EtapeImport
  importId: string | null
  recetteExtractee: RecetteExtractee | null
  recetteId: string | null
  erreur: string | null
}

export function useImportWorkflow() {
  const [etat, setEtat] = useState<EtatImport>({
    etape:            'saisie',
    importId:         null,
    recetteExtractee: null,
    recetteId:        null,
    erreur:           null,
  })

  const importerTexte = useCallback(async (texte: string) => {
    setEtat(e => ({ ...e, etape: 'extraction', erreur: null }))
    try {
      const { importId, recette } = await importerDepuisTexte(texte)
      setEtat(e => ({
        ...e,
        etape:            'validation',
        importId,
        recetteExtractee: recette,
      }))
    } catch (err) {
      setEtat(e => ({
        ...e,
        etape:  'erreur',
        erreur: err instanceof Error ? err.message : 'Erreur extraction',
      }))
    }
  }, [])

  const importerURL = useCallback(async (url: string, texteColle: string) => {
    setEtat(e => ({ ...e, etape: 'extraction', erreur: null }))
    try {
      const { importId, recette } = await importerDepuisURL(url, texteColle)
      setEtat(e => ({
        ...e,
        etape:            'validation',
        importId,
        recetteExtractee: recette,
      }))
    } catch (err) {
      setEtat(e => ({
        ...e,
        etape:  'erreur',
        erreur: err instanceof Error ? err.message : 'Erreur extraction',
      }))
    }
  }, [])

  const importerImage = useCallback(async (imageBase64: string, sourceUrl?: string) => {
    setEtat(e => ({ ...e, etape: 'extraction', erreur: null }))
    try {
      const { importId, recette } = await importerDepuisImage(imageBase64, sourceUrl)
      setEtat(e => ({
        ...e,
        etape:            'validation',
        importId,
        recetteExtractee: recette,
      }))
    } catch (err) {
      setEtat(e => ({
        ...e,
        etape:  'erreur',
        erreur: err instanceof Error ? err.message : 'Erreur extraction',
      }))
    }
  }, [])

  const valider = useCallback(async (data: RecetteValideeFormData) => {
    if (!etat.importId) return
    setEtat(e => ({ ...e, etape: 'sauvegarde' }))
    try {
      const recetteId = await validerEtSauvegarder(etat.importId, data)
      setEtat(e => ({ ...e, etape: 'succes', recetteId }))
    } catch (err) {
      setEtat(e => ({
        ...e,
        etape:  'erreur',
        erreur: err instanceof Error ? err.message : 'Erreur sauvegarde',
      }))
    }
  }, [etat.importId])

  const reessayer = useCallback(async () => {
    if (!etat.importId) return
    setEtat(e => ({ ...e, etape: 'extraction', erreur: null }))
    try {
      const recette = await reessayerImport(etat.importId)
      setEtat(e => ({ ...e, etape: 'validation', recetteExtractee: recette }))
    } catch (err) {
      setEtat(e => ({
        ...e,
        etape:  'erreur',
        erreur: err instanceof Error ? err.message : 'Erreur',
      }))
    }
  }, [etat.importId])

  const reinitialiser = useCallback(() => {
    setEtat({ etape: 'saisie', importId: null, recetteExtractee: null, recetteId: null, erreur: null })
  }, [])

  const archiver = useCallback(async () => {
    if (etat.importId) await archiverImport(etat.importId)
    reinitialiser()
  }, [etat.importId, reinitialiser])

  return {
    etat,
    importerTexte,
    importerURL,
    importerImage,
    valider,
    reessayer,
    reinitialiser,
    archiver,
  }
}
