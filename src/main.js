import Phaser from 'phaser';
import { GameScene } from './GameScene.js';

const config = {
    type: Phaser.AUTO,
    // On utilise window.innerWidth/Height pour détecter la taille du navigateur
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: '#0a0a12',
    scale: {
        // Ce mode étire le jeu pour remplir l'espace disponible
        mode: Phaser.Scale.RESIZE,
        // Centrage automatique dans le navigateur
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [GameScene]
};

new Phaser.Game(config);