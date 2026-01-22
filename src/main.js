import Phaser from 'phaser';
import { GameScene } from './GameScene.js';

const config = {
    type: Phaser.AUTO,
    // On lie Phaser à la div du HTML
    parent: 'game-container',
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: '#050510',
    scale: {
        // FIT est plus stable que RESIZE pour un jeu de plateau comme le nôtre
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    // Gestion de l'audio pour éviter les blocages navigateurs
    audio: {
        disableWebAudio: false
    },
    scene: [GameScene]
};

// Lancement du jeu
window.addEventListener('load', () => {
    new Phaser.Game(config);
});