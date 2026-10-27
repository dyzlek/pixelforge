# Architecture et Conception du Studio Audio DAW v2 PixelForge

Ce document decrit l'architecture technique, le modele de donnees et les principes d'implementation du studio audio PixelForge DAW v2 (Phase G).

---

## 1. Vision et Principes Directeurs

PixelForge propose un studio musical integre permettant de composer a la fois des chiptunes retro NES / Game Boy authentiques et des bandes-son modernes multi-genres directement dans le navigateur.

### Principes Fondamentaux :
1. **Zero import externe dans le moteur audio** : Le runtime audio (`src/audio/chip.js`) reste autonome et sans aucune dependance (zero import ES, zero bibliotheque tierce). Il fonctionne exclusivement avec l'API WebAudio native du navigateur.
2. **Retro-compatibilite totale et sans perte** : Les morceaux existants bases sur `channels[]`, `patterns[]` et `playlist[]` continuent de jouer exactement a l'identique. La migration par `normalizeProject` est transparente et reversible.
3. **Budget memoire et legerete** : Le format de projet PixelForge reste un fichier JSON unique. Les echantillons audio sont integres sous forme de data URLs compressees avec un budget strict pour preserver la reactivite.
4. **Performance temps reel a faible latence** : Planificateur hybride JS / WebAudio garantissant la synchronisation rythmique sans saccade meme lors du masquage de l'onglet ou d'une chute temporaire de framerate.

---

## 2. Modele de Donnees DAW v2

Le modele enrichit l'objet `song` defini dans le schema du projet (`docs/PROJECT_SCHEMA.json`).

### Structure d'un morceau (`song`)

```json
{
  "id": "sng_theme_v2",
  "name": "Theme Principal",
  "bpm": 130,
  "timeSignature": [4, 4],
  "swing": 0.0,
  "tracks": [
    {
      "id": "trk_lead",
      "name": "Lead Synth",
      "color": "#41a6f6",
      "volume": 0.8,
      "pan": 0.0,
      "mute": false,
      "solo": false,
      "outputBusId": "master",
      "instrument": {
        "type": "synth_sub",
        "preset": "retro_lead_1",
        "params": {
          "osc1": { "wave": "saw", "octave": 0, "tune": 0, "mix": 0.8 },
          "osc2": { "wave": "pulse50", "octave": -1, "tune": 7, "mix": 0.5 },
          "filter": { "type": "lowpass", "cutoff": 2400, "resonance": 3.5, "envAmount": 0.6 },
          "envAmp": { "a": 0.01, "d": 0.2, "s": 0.6, "r": 0.15 },
          "envFilter": { "a": 0.02, "d": 0.3, "s": 0.2, "r": 0.1 },
          "lfo": { "target": "pitch", "rate": 5.5, "depth": 0.08 }
        }
      },
      "effects": [
        { "type": "distortion", "bypass": false, "drive": 0.35, "mix": 0.4 },
        { "type": "delay", "bypass": false, "time": "3/16", "feedback": 0.35, "mix": 0.25 }
      ],
      "sends": [
        { "busId": "aux_reverb", "amount": 0.3 }
      ]
    }
  ],
  "clips": [
    {
      "id": "clp_lead_verse",
      "trackId": "trk_lead",
      "type": "notes",
      "start": 0,
      "length": 64,
      "offset": 0,
      "loop": false,
      "notes": [
        { "step": 0, "pitch": "C4", "length": 4, "velocity": 0.9 },
        { "step": 4, "pitch": "D#4", "length": 4, "velocity": 0.85 },
        { "step": 8, "pitch": "G4", "length": 8, "velocity": 0.95 }
      ]
    }
  ],
  "automation": [
    {
      "trackId": "trk_lead",
      "target": "filter.cutoff",
      "points": [
        { "step": 0, "value": 1200 },
        { "step": 64, "value": 3600 }
      ]
    }
  ],
  "loop": {
    "enabled": true,
    "start": 0,
    "end": 64
  }
}
```

---

## 3. Typologie des Instruments et Generateurs

Le studio propose cinq familles d'instruments :

### A. Chiptune Retro Authentique (`type: 'chiptune'`)
- Formes d'ondes NES / Game Boy : `pulse12` (12.5% duty), `pulse25` (25% duty), `pulse50` (carree 50%), `triangle`, `saw`, `noise` (bruit blanc / periodique metallique).
- Tables d'ondes 16 etapes personnalisables (`waveTable` 4-bit, style Game Boy DMG / SCC Konami).
- Arpegiateurs materiels ultra-rapides a 60 Hz pour simuler des accords avec une seule voix.

### B. Synthetiseur Soustractif Retro (`type: 'synth_sub'`)
- Double oscillateur (Osc 1 + Osc 2) avec melangeur, desaccord fin (cents) et decrochage d'octave (-2 a +2).
- Filtre resonant biquad (passe-bas 12/24 dB, passe-haut, passe-bande).
- Double enveloppe ADSR : enveloppe d'amplitude et enveloppe de filtre modulee.
- LFO multi-ondes assignable au pitch (vibrato), au volume (tremolo) ou a la frequence de coupure (wah/autofilter).

### C. Synthetiseur FM 4 Operateurs (`type: 'synth_fm'`)
- 4 operateurs sinusoidaux relies selon 8 algorithmes standards (DX-style).
- Ratios harmoniques (0.5 a 16.0), boucle de retroaction (feedback) sur l'operateur 1.
- Enveloppes ADSR individuelles par operateur permettant des textures cuivrees, metalliques, cloches ou basses percutantes.

### D. Echantillonneur Polyphonique (`type: 'sampler'`)
- Lecture d'echantillons audio (WAV, OGG, audio base64).
- Mode de bouclage : One-shot, Boucle avant (Forward Loop), Boucle ping-pong.
- Definition de la note racine (root pitch) et suivi de note clavier (pitch tracking).
- Enveloppe ADSR de modulation d'amplitude pour sculpter l'attaque et le declin des echantillons.

### E. Boite a Rythmes a Pads (`type: 'drum_machine'`)
- 8 a 16 pads rythmiques assignables.
- Sons par defaut proceduraux sfxr (Kick punchy, Snare percutant, Hi-Hat ferme/ouvert, Tom, Cymbale, Clap, Laser).
- Entrees personnalisees d'echantillons courts percussifs.

---

## 4. Chaines d'Effets et Mixeur

Chaque piste dispose d'une suite d'effets modulaires ordonnables :

1. **Reverberation (`reverb`)** : Simulation d'espace acoustique par reseau de filtres Schroeder / peigne et passe-tout, parametres : `roomSize`, `damp`, `predelay`, `mix`.
2. **Delai / Echo stereo (`delay`)** : Ligne a retard stereo synchronisable au tempo (en fractions de temps : 1/4, 1/8, 1/16, pointees), retour `feedback`, filtre de coupure passe-bas.
3. **Egaliseur 3 bandes (`eq3`)** : Grave (low shelf 100 Hz), medium (peaking 1 kHz, Q reglable), aigu (high shelf 8 kHz).
4. **Compresseur dynamique (`compressor`)** : Controle dynamique du gain, seuil (`threshold`), taux (`ratio`), temps d'attaque (`attack`), relachement (`release`), knee et gain de rattrapage.
5. **Distorsion / Overdrive (`distortion`)** : Saturation analogique par courbe de transfert mathematique `WaveShaperNode` soft-clipping ou hard-clipping.
6. **Bitcrusher (`bitcrusher`)** : Reducteur de resolution en bits (quantification de 2 a 16 bits) et sous-echantillonnage (downsampling) pour sonorite 8-bit lofi granulaire.
7. **Chorus stereo (`chorus`)** : Doubleur harmonique avec delais modules par LFO quadrature pour un son large et epais.

---

## 5. Retro-compatibilite et Migration sans Perte

La fonction `normalizeProject(project)` dans `src/core/project.js` maintient la compatibilite entre les morceaux historiques et le nouveau modele :

- Si un morceau possede `channels[]` et `patterns[]` :
  - Chaque `channel` est mappe sur une `track` avec son instrument chiptune correspondant.
  - La playlist de patterns existante est preservee sans modification.
- Si un morceau possede des `tracks[]` et des `clips[]` :
  - Les informations sont traduites vers `channels[]` et `patterns[]` pour assurer la compatibilite avec les runtimes et exports actuels.
- Aucune donnee n'est detruite : les deux representations coexistent harmonieusement.

---

## 6. Budget Memoire des Echantillons Audio

Pour garantir que les jeux PixelForge restent legers, autonomes et facilement partageables :
- **Budget par echantillon individuel** : 500 Ko maximum.
- **Budget cumulatif par projet** : 5 Mo au total pour l'ensemble des sons et echantillons.
- **Encodage** : Data URL audio/wav ou audio/ogg base64.
- **Avertissement de validation** : Le validateur `validateProject` emet un avertissement si un echantillon depasse 300 Ko et une erreur bloquante au-dela de 2 Mo.

---

## 7. Moteur d'Execution Temps Reel (`chip.js` v2)

- **Architecture sans import** : Fonction globale ou fonction constructrice autonome `createChipAudio()`.
- **Graphe WebAudio hierarchique** :
  `Sources d'oscillateurs / echantillons -> Gain enveloppe -> Piste FX Chain -> Fader Volume / Pan -> Master Bus -> AudioDestination`.
- **Planificateur robuste a double horloge** :
  - Boucle d'anticipation `setInterval` toutes les 25 millisecondes.
  - Programmation des evenements sur le flux audio WebAudio precis (`audioCtx.currentTime`) avec un horizon temporel de 100 ms.
  - Immunite absolue contre les latences de l'onglet et le multitache.
