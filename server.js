const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    console.log('玩家连入:', socket.id);

    // 1. 创建新玩家
    players[socket.id] = {
        id: socket.id,
        x: 800 + Math.random() * 400,
        y: 600 + Math.random() * 400,
        z: 0,
        hp: 100,
        superCharge: 0
    };

    // 2. 告诉新玩家当前有哪些人，并告诉其他人有新人来了
    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 3. 处理移动同步
    socket.on('playerMovement', (moveData) => {
        if (players[socket.id]) {
            players[socket.id].x = moveData.x;
            players[socket.id].y = moveData.y;
            players[socket.id].z = moveData.z;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 4. 处理大招砸地（由服务器广播伤害）
    socket.on('dunkImpact', (impactData) => {
        socket.broadcast.emit('enemyDunked', {
            x: impactData.x,
            y: impactData.y,
            id: socket.id
        });
        // 简单的伤害计算：遍历所有玩家看谁在圈内
        Object.keys(players).forEach(id => {
            if (id !== socket.id) {
                let d = Math.hypot(players[id].x - impactData.x, players[id].y - impactData.y);
                if (d < 150) {
                    players[id].hp -= 40;
                    io.emit('hpUpdate', { id: id, hp: players[id].hp });
                }
            }
        });
    });

    // 5. 离线处理
    socket.on('disconnect', () => {
        console.log('玩家离开:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

http.listen(3000, () => {
    console.log('服务器启动成功！地址: http://localhost:3000');
});
