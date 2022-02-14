const request = require('request-promise');
const cheerio = require('cheerio');
const fs = require('fs');
const tmi = require('tmi.js');
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const utf8 = require('utf8');

const Filehound = require('filehound');

var rank = [];
var problemas = [];
var problemaAtual;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('a user connected');

    // Iniciar problema
    enviarQuestao();

    fs.readFile('rank/rank.txt', 'utf8', async (err, resp) => {
        rank = JSON.parse(resp);

        // Atualizar rank
        io.emit("updateRank", rank);
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});

var camisoleURL = "http://localhost:42920/run";

const client = new tmi.Client({
    options: { debug: true },
    connection: {
        secure: true,
        reconnect: true
    },
    identity: {
        username: 'CompiladorBot',
        password: 'token'
    },
    channels: ['liveprog']
});
    
client.connect();

function carregarPrimeiraQuestao(){
    Filehound.create()
    .path("problemas")
    .directory()
    .find()
    .then((subdirectories) => {


        for(var item in subdirectories){
            var html = fs.readFileSync(subdirectories[item] + "\\problem.html", {encoding:'utf8', flag:'r'});
            var input = fs.readFileSync(subdirectories[item] + "\\input.txt", {encoding:'utf8', flag:'r'});
            var output = fs.readFileSync(subdirectories[item] + "\\output.txt", {encoding:'utf8', flag:'r'});
            
            problemas.push({'title': subdirectories[item].split('\\')[1], 'html': html, input: input, output: output});

            if(problemas.length == subdirectories.length){
                // Atualizar problema
                problemaAtual = problemas[(Math.random() * problemas.length) | 0];
                io.emit("teste", problemaAtual['html']);

                console.log("Problem:", problemaAtual['title']);
            }
        }
    });
}

carregarPrimeiraQuestao();

function enviarQuestao(){
    problemaAtual = problemas[(Math.random() * problemas.length) | 0];

    io.emit("teste", problemaAtual['html']);

    console.log("Problem:", problemaAtual['title']);
}

client.on('message', (channel, tags, message, self) => {
    if(self) return;

    if(message.includes("!run")){       
        var arr = message.split(' ');
        var pastebinURL = arr[1];
        var linguagem = arr[2];

        getCode(pastebinURL, linguagem, tags.username);
    }
});

async function getCode(url, tipo, user){
    const options = {
        uri: url,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36'
        },
        transform: function (body) {
            return cheerio.load(body)
        }
    }

    await request(options).then(async $ => {
        var codigo = $('.textarea').text();

        // trocar nome da classe para o nome da twitch
        if(tipo == "java"){
            var index = codigo.indexOf("class") + 5;
            var indexEnd = codigo.indexOf("{", index);
            var result = codigo.split('');
            result.splice(index, indexEnd - index);
            codigo = result.join('');
            codigo = codigo.substr(0, index) + ` ${user} ` + codigo.substr(index)
        }

        console.log(codigo);

        axios.post(camisoleURL, {
                "lang": tipo,
                "source": codigo,
                "tests": [
                    {"name": "default", "stdin": problemaAtual['input'], "time": 10}
                ]
            })
            .then(res => {
                var resultado = utf8.encode(res['data']['tests'][0]['stdout'].trim().normalize().replace(/(\r\n|\n|\r)/gm, ""));
                var outputEsperado = problemaAtual['output'].trim().normalize().replace(/(\r\n|\n|\r)/gm, "");

                if(resultado === outputEsperado) {
                    problemaAtual = problemas[(Math.random() * problemas.length) | 0];
                    io.emit("teste", problemaAtual['html']);

                    console.log(user + " acertou a questão.");
                    updateRank(user, 100);

                    client.say('liveprog', `@${user} Congratulations! Your solution is correct and you earn +100 points.`);
                } else {
                    console.log(user + " errou a questão.");

                    client.say('liveprog', `@${user} Sorry, your solution is not correct.`);
                }
            })
            .catch(error => {
                console.error(error)
            })
    });
}

function updateRank(user, points){
    var achou = false;

    for(var u in rank){
        if(rank[u][0] == user) {
            rank[u][1] += points;
            achou = true;
        }
    }

    if(!achou) rank.push([user, points]);

    io.emit("updateRank", rank);

    fs.writeFile("./rank/rank.txt", JSON.stringify(rank), function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("Rank salvo com sucesso!");
    }); 
}
