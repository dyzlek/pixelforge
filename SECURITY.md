# Politique de sécurité de PixelForge

## Signalement d'une vulnérabilité

Si vous découvrez une faille ou un problème de sécurité dans PixelForge, merci de ne **pas** ouvrir d'issue publique. Signalez-le de manière responsable en contactant directement le mainteneur via GitHub Security Advisories ou par e-mail privé.

## Modèle d'exécution et avertissement de sécurité

> [!WARNING]
> Les scripts de jeu dans PixelForge (qu'ils soient créés en mode Code ou compilés depuis les Blueprints) s'exécutent dans l'environnement du navigateur hôte à l'aide de constructeurs JavaScript (`new Function`).

1. **Origine et confiance** : Ne chargez et n'exécutez jamais dans votre éditeur un fichier `.pixelforge.json` provenant d'une source inconnue ou non fiable. Les scripts du jeu s'exécutent avec les mêmes droits que l'application web elle-même (accès au stockage local, IndexedDB et réseau).
2. **Exports autonomes** : Les fichiers HTML exportés incluent le code source du jeu. Si vous hébergez des jeux créés par des utilisateurs tiers sur une plateforme web, il est impératif d'isoler l'affichage dans une `<iframe>` dotée des attributs `sandbox="allow-scripts"` sur un domaine ou une origine distincte pour empêcher tout accès au stockage de l'origine principale.
