// ============================================================
//  main.js — Configuration et démarrage du jeu Phaser
// ============================================================

// L'objet "config" dit à Phaser COMMENT créer le jeu.
// C'est le point d'entrée unique : tout part de là.
const config = {

    // Le moteur de rendu : Phaser choisit automatiquement
    // WebGL (GPU, rapide) ou Canvas 2D si WebGL n'est pas dispo
    type: Phaser.AUTO,

    // Dimensions du canvas (la "fenêtre" du jeu)
    width: 1280,
    height: 720,

    // Couleur de fond par défaut (noir espace)
    backgroundColor: '#0a0a1a',

    // Configuration du moteur physique Arcade
    // Arcade = physique simple et rapide (rectangles/cercles)
    // On DÉSACTIVE la gravité globale de Phaser car on gère
    // notre propre gravité planétaire manuellement dans update()
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },  // Pas de gravité verticale globale !
            debug: false         // Mettre "true" pour voir les hitboxes
        }
    },

    // Liste des scènes du jeu, dans l'ordre de démarrage
    // Phaser lance automatiquement la PREMIÈRE scène de la liste
    scene: [
        MenuScene,   // Écran d'accueil (lancé en premier)
        GameScene,   // Le jeu principal
        WinScene     // Écran de victoire
    ]
};

// Création de l'instance Phaser — ça démarre tout !
// Phaser crée un <canvas> et l'injecte dans le <body>
const game = new Phaser.Game(config);
