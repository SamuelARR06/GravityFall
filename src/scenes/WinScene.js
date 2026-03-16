// ============================================================
//  WinScene.js — Écran de victoire
// ============================================================

class WinScene extends Phaser.Scene {

    constructor() {
        super({ key: 'WinScene' });
    }

    // init() est appelé avant preload() et reçoit les données
    // passées par scene.start('WinScene', { time: elapsed })
    init(data) {
        this.finalTime = data.time || 0;
    }

    preload() {}

    create() {
        const { width, height } = this.scale;

        // --- Fond étoilé ---
        for (let i = 0; i < 150; i++) {
            this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.FloatBetween(0.5, 2),
                0xffffff,
                Phaser.Math.FloatBetween(0.2, 0.9)
            );
        }

        // --- Titre ---
        this.add.text(width / 2, height * 0.25, 'VOUS AVEZ SURVÉCU !', {
            fontSize: '56px',
            fontFamily: 'Arial Black',
            color: '#44ff88',
            stroke: '#006633',
            strokeThickness: 5
        }).setOrigin(0.5);

        // --- Planète safe animée ---
        const planet = this.add.circle(width / 2, height * 0.48, 60, 0x44ff88);
        planet.setStrokeStyle(3, 0xffffff, 0.6);

        this.tweens.add({
            targets: planet,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // --- Score : temps ---
        this.add.text(width / 2, height * 0.65, `Temps : ${this.finalTime} secondes`, {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffffff'
        }).setOrigin(0.5);

        // --- Rejouer ---
        const replayText = this.add.text(width / 2, height * 0.78,
            'Appuie sur ESPACE pour rejouer', {
            fontSize: '22px',
            fontFamily: 'Arial',
            color: '#aaaaff'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: replayText,
            alpha: 0,
            duration: 700,
            yoyo: true,
            repeat: -1
        });

        // --- Input ---
        const space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        space.once('down', () => this.scene.start('MenuScene'));
        this.input.once('pointerdown', () => this.scene.start('MenuScene'));
    }

    update() {}
}
