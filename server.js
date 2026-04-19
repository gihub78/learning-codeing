const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    console.log('玩家连入:', socket.id);

    players[socket.id] = {
        id: socket.id,
        x: 800 + Math.random() * 400,
        y: 600 + Math.random() * 400,
        z: 0,
        hp: 100,
        superCharge: 100
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (moveData) => {
        if (players[socket.id]) {
            players[socket.id].x = moveData.x;
            players[socket.id].y = moveData.y;
            players[socket.id].z = moveData.z;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 处理近战挥刀
    socket.on('meleeAttack', (data) => {
        const p = players[socket.id];
        if (!p) return;
        
        const RANGE = 120;
        const SPREAD = Math.PI / 1.5; // 约120度扇形

        Object.keys(players).forEach(id => {
            if (id === socket.id) return;
            const target = players[id];
            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const dist = Math.hypot(dx, dy);

            if (dist < RANGE) {
                const angleToTarget = Math.atan2(dy, dx);
                let angleDiff = Math.abs(angleToTarget - data.angle);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

                if (angleDiff < SPREAD / 2) {
                    target.hp -= 15;
                    p.superCharge = Math.min(100, (p.superCharge || 0) + 10);
                    io.emit('hpUpdate', { id: id, hp: target.hp });
                    io.emit('superUpdate', { id: socket.id, charge: p.superCharge });
                    
                    if (target.hp <= 0) {
                        target.hp = 100;
                        target.x = 800 + Math.random() * 400;
                        target.y = 600 + Math.random() * 400;
                        io.emit('playerRespawn', target);
                    }
                }
            }
        });
        socket.broadcast.emit('enemyMelee', { id: socket.id, angle: data.angle });
    });

    // 处理大招砸地
    socket.on('dunkImpact', (data) => {
        players[socket.id].superCharge = 0;
        io.emit('superUpdate', { id: socket.id, charge: 0 });
        socket.broadcast.emit('enemyDunked', data);

        Object.keys(players).forEach(id => {
            if (id !== socket.id) {
                let dist = Math.hypot(players[id].x - data.x, players[id].y - data.y);
                if (dist < 150) {
                    players[id].hp -= 45;
                    if (players[id].hp <= 0) {
                        players[id].hp = 100;
                        players[id].x = 800 + Math.random() * 400;
                        players[id].y = 600 + Math.random() * 400;
                        io.emit('playerRespawn', players[id]);
                    } else {
                        io.emit('hpUpdate', { id: id, hp: players[id].hp });
                    }
                }
            }
        });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

http.listen(3000, () => console.log('游戏启动: http://localhost:3000'));
