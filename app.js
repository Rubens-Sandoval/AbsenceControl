const express = require("express")
const app = express()
const exphdb = require("express-handlebars").engine
const handlebars = require("handlebars")
const bodyParser = require("body-parser")
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app')
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')

const serviceAccount = require('./faltas-261ab-firebase-adminsdk-qtf3x-1459df349b.json')

initializeApp({
    credential: cert(serviceAccount)
})

const db = getFirestore()

app.engine("handlebars", exphdb({defaultLayout: "main"}))
app.set("view engine", "handlebars")

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

// Switch case para converter o dia da semana para String
handlebars.registerHelper('switchDia', function(dia) {
    switch(dia){
        case 1:
            return 'Segunda-Feira';
        case 2:
            return 'Terça-Feira';
        case 3:
            return 'Quarta-Feira';
        case 4:
            return 'Quinta-Feira';
        case 5:
            return 'Sexta-Feira';
        case 6:
            return 'Sábado';
    }
});

// If para comparar dois valores
handlebars.registerHelper('ifValues', function(dia, op, options) {
    if(dia === op){
        return options.fn(this)
    }
    return options.inverse(this)
});

handlebars.registerHelper('ifExists', function(sigla) {
    if(sigla){
        return sigla
    }else{
        return '(sem sigla)'
    }
});

app.get("/", async(req, res) => {
    const batch_size = 9;

  try {
    // Obter todos os documentos em grupos de 9
    const data = [];
    let dataAux = [];
    let query = db.collection('materias').limit(batch_size);
    let snapshot = await query.get();

    // Processar os documentos obtidos
    snapshot.forEach((doc) => {
      dataAux.push({
        id: doc.id,
        sigla: doc.data().sigla,
        quantFaltas: doc.data().quantFaltas,
        quantAulas: doc.data().quantAulas
      });
    });
    data.push(dataAux)

    // Verificar se existem mais documentos para obter
    while (snapshot.size > 0) {
        dataAux = []
        // Obter o último documento da página atual
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  
        // Construir a próxima query para a próxima página de documentos
        query = db.collection('materias').startAfter(lastVisible).limit(batch_size);
        snapshot = await query.get();
  
        // Processar os documentos obtidos
        snapshot.forEach((doc) => {
          dataAux.push({
            id: doc.id,
            sigla: doc.data().sigla,
            quantFaltas: doc.data().quantFaltas,
            quantAulas: doc.data().quantAulas
          });
        });
        if(dataAux.length > 0){
            data.push(dataAux)
        }
    }
    res.render('index', { data });
    } catch (error) {
        console.log('Erro ao obter documentos:', error);
        res.send('Erro na consulta');
    }
})

app.get("/addFalta/:id/:quantAulas/:quantFaltas", function(req, res){
    const id = req.params.id
    const quantAulas = parseInt(req.params.quantAulas)
    const quantFaltas = parseInt(req.params.quantFaltas)
    
    // Adiciona as novas faltas as faltas existentes
    const faltasAtuais = quantFaltas + quantAulas

    db.collection('materias').doc(id)
    .update({
        quantFaltas: faltasAtuais
    })
    .then(() => {
        console.log("Faltas adicionadas")
        res.redirect('/')
    })
    .catch((error) => {
        console.log("Ocorreu um erro ao adicionar a falta: ", error)
        res.send('Erro ao adicionar falta')
    })
})

app.get("/delFalta/:id/:quantAulas/:quantFaltas", function(req, res){
    const id = req.params.id
    const quantAulas = parseInt(req.params.quantAulas)
    const quantFaltas = parseInt(req.params.quantFaltas)
    
    // Remove as faltas da quantidade de aulas cadastradas
    let faltasAtuais = quantFaltas - quantAulas
    if (faltasAtuais < 0){
        faltasAtuais = 0
    }

    db.collection('materias').doc(id)
    .update({
        quantFaltas: faltasAtuais
    })
    .then(() => {
        console.log("Faltas removidas")
        res.redirect('/')
    })
    .catch((error) => {
        console.log("Ocorreu um erro ao remover a falta: ", error)
        res.send('Erro ao remover falta')
    })
})

app.get("/editar/:id", function(req, res){
    const id = req.params.id

    // Buscar documento com o id fornecido
    const docRef = db.collection('materias').doc(id)

    // Obter dados do documento
    docRef.get()
    .then((doc) => {
        if (doc.exists){
            // O documento existe, é possível acessar os dados
            const data = [{
                id: doc.id,
                sigla: doc.data().sigla,
                nome: doc.data().nome,
                dia: parseInt(doc.data().dia),
                quantAulas: Number(doc.data().quantAulas),
                quantFaltas: Number(doc.data().quantFaltas),
            }]
            res.render('editarMaterias', {data: data})
        } else {
            res.send('Materia não encontrada! :(')
        }
    })
    .catch((error) => {
        console.log('Erro ao buscar matéria: ', error)
        red.send('Erro ao buscar materia')
    })
})

app.post("/atualizar/:id", function(req, res){
    const id = req.params.id
    const {sigla, nome, dia, quantAulas, quantFaltas} = req.body

    db.collection('materias').doc(id)
    .update({
        sigla: sigla,
        nome: nome,
        dia: dia,
        quantAulas: quantAulas,
        quantFaltas: quantFaltas
    })
    .then(() => {
        console.log("Materia editada com sucesso!!")
        res.redirect('/consulta')
    })
    .catch((error) => {
        console.log("Falha  ao tentar editar a materia: ", error)
        res.send("Falha ao atualizar a materia")
    })
})

app.get("/consulta", function(req, res){
    const data = [];
    db.collection('materias').get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                // Acessa os atributos do documento
                const id = doc.id;
                const nome = doc.data().nome;
                const sigla = doc.data().sigla;
                const dia = doc.data().dia;
                const quantAulas = doc.data().quantAulas;
                const quantFaltas = doc.data().quantFaltas;

                // Adiconas os dados ao array 'data'
                data.push({
                    id: id,
                    nome: nome,
                    sigla: sigla,
                    dia: parseInt(dia),
                    quantAulas: Number(quantAulas),
                    quantFaltas: Number(quantFaltas)
                })
            })
            res.render('consultaMaterias', { data: data })
        })
        .catch((error) => {
            console.log('Erro ao obter documentos: ', error)
            res.send('Erro ao obter documentos')
        })
})

app.get("/cadastro", function(req,res){
    res.render("cadastroMaterias")
})

app.get("/excluir/:id/:sigla", function(req, res){
    const id = req.params.id;
    const sigla = req.params.sigla
    
    // Exibe o alerta de confirmação no navegador
    res.send(`
      <script>
        if (confirm('Tem certeza que deseja excluir o item com a sigla ${sigla}?')) {
          // Se confirmado, redireciona para a rota de exclusão
          window.location.href = '/excluir-item/${id}';
        } else {
          // Se cancelado, redireciona para uma rota de cancelamento ou página inicial, por exemplo
          window.location.href = '/consulta';
        }
      </script>
    `)
})

app.get("/excluir-item/:id", function(req, res){
    const id = req.params.id;
    db.collection('materias').doc(id).delete()
    .then(function(){
        console.log("documento: " + id + " excluído com sucesso.")
        res.redirect('/consulta')
    })
    .catch((error) => {
        console.log("Erro ao excluir o documento:", error);
        res.send("Erro ao excluir o documento");
    })
})

app.post("/cadastrar", function(req, res){
    db.collection('materias').add({
        sigla: req.body.sigla,
        nome: req.body.nome,
        dia: parseInt(req.body.dia),
        quantAulas: Number(req.body.quantAulas),
        quantFaltas: Number(req.body.quantFaltas)
    }).then(function(){
        console.log('Materia adicionada.')
        res.redirect('/')
    })
})

app.listen(8081, function(){
    console.log("Servidor ativo!")
})