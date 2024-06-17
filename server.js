const express = require("express");
const app = express();
const { ObjectId } = require("mongodb");
const methodOverride = require("method-override");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();
app.use(passport.initialize());
app.use(
  session({
    secret: "b90e94f9294f1665463f477c2ef7f0de73688f10f7013c06468448ec67c82aa5",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));

app.set("view engine", "ejs");

const { MongoClient } = require("mongodb");

let db;
const url = process.env.mongoDB_URL;
const multer = require("multer");
const multerS3 = require("multer-s3");
const e = require("express");
const s3 = new S3Client({
  region: "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "storageofswe",
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()); //업로드시 파일명 변경가능
    },
  }),
});

new MongoClient(url)
  .connect()
  .then((client) => {
    console.log("DB연결성공");
    db = client.db("BUMarket");

    app.listen(8080, () => {
      console.log("http://localhost:8080 에서 서버 실행중");
    });
  })
  .catch((err) => {
    console.log(err);
  });

app.get("/", async (req, res) => {
  // let result1 = await db.collection("OWunWan").find().sort({ date: -1 }).limit(10).toArray();
  // let result2 = await db.collection("PostureQnA").find().sort({ date: -1 }).limit(10).toArray();
  // let userId = false;
  // let result = false;
  // let nickname = false;
  // if (req.user) {
  //   userId = req.user._id;
  //   nickname = req.user.nickname;
  //   result = await db.collection("user").findOne({ _id: new ObjectId(userId) });
  // }
  let result = [];
  res.render("index.ejs", { result: result });
});

app.get("/menu/:menu", (req, res) => {
  let menu = req.params.menu;
  res.render(menu + ".ejs");
});

app.get("/category/:category", async (req, res) => {
  let result = await db.collection("sell").find({ category: req.params.category }).sort({ date: -1 }).toArray();
  console.log(result);
  res.render("list.ejs", { result: result });
});

app.post("/sell_submit", async (req, res) => {
  upload.array("img", 4)(req, res, async (err) => {
    if (err) return res.send("이미지 업로드 중 에러가 발생했습니다.");
    let imgUrl = [];
    for (let i = 0; i < req.files.length; i++) {
      imgUrl.push(req.files[i].location);
    }
    if (req.body.title === "") {
      res.send("제목을 입력해주세요");
    } else {
      //제목이 입력되었을때만 저장
      await db.collection("sell").insertOne({
        title: req.body.title,
        description: req.body.description,
        // user: req.user._id,
        // username: req.user.username,
        // nickname: req.user.nickname,
        like: false,
        price: req.body.price,
        contact: req.body.contact,
        category: req.body.category,
        imgUrl: imgUrl,
        date: new Date(),
      });
      res.redirect("/");
    }
  });
});

app.get("/detail/:id", async (req, res) => {
  try {
    let result = await db.collection("sell").findOne({ _id: new ObjectId(req.params.id) });
    if (result == null) {
      res.status(400).send("존재하지 않는 URL 입니다.");
    } else {
      console.log(result);
      res.render("detail.ejs", { result: result });
    }
  } catch (error) {
    console.log(error);
    res.status(400).send("존재하지 않는 URL 입니다.");
  }
});
// 오운완 서버 코드

app.get("/OWunWan/:page", ensureAuthenticated, async (req, res) => {
  //게시글목록
  let pageCount = await db.collection("OWunWan").countDocuments();
  let totalPage = Math.ceil(pageCount / 8);

  res.render("OWunWan.ejs", { result: result, totalPage: totalPage, userId: req.user._id });
});

app.get("/OWunWan", (req, res) => {
  // /OWunWan 경로로 요청이 들어오면 /OWunWan/1로 리다이렉트
  res.redirect("/OWunWan/1");
});

app.get("/OWunWanWrite", ensureAuthenticated, async (req, res) => {
  //오운완 게시물 작성
  res.render("OWunWanWrite.ejs");
});

app.post("/OWunWan_post", ensureAuthenticated, async (req, res) => {
  upload.array("img", 4)(req, res, async (err) => {
    if (err) return res.send("이미지 업로드 중 에러가 발생했습니다.");

    try {
      let imgUrl = [];
      for (let i = 0; i < req.files.length; i++) {
        imgUrl.push(req.files[i].location);
      }
      if (req.body.title === "") {
        res.send("제목을 입력해주세요");
      } else {
        //제목이 입력되었을때만 저장
        await db.collection("OWunWan").insertOne({
          title: req.body.title,
          content: req.body.content,
          user: req.user._id,
          username: req.user.username,
          nickname: req.user.nickname,
          imgUrl: imgUrl,
          date: new Date(),
        });
        res.redirect("/OWunWan");
      }
    } catch (error) {
      res.send("DB error!");
    }
  });
});

app.get("/OWunWan/detail/:id", ensureAuthenticated, async (req, res) => {
  // 오운완 상세페이지

  try {
    let result = await db.collection("OWunWan").findOne({ _id: new ObjectId(req.params.id) });
    let comment = await db.collection("comment").find({ parentId: req.params.id }).toArray();
    if (result == null) {
      res.status(400).send("존재하지 않는 URL 입니다.");
    } else {
      res.render("OWunWanDetail.ejs", { result: result, comment: comment });
    }
  } catch (error) {
    console.log(error);
    res.status(400).send("존재하지 않는 URL 입니다.");
  }
});

app.get("/OWunWan_edit/:id", ensureAuthenticated, async (req, res) => {
  //수정할 게시글 불러오기
  let result = await db.collection("OWunWan").findOne({ _id: new ObjectId(req.params.id) });
  res.render("OWunWan_edit.ejs", { result: result });
});

app.put("/OWunWan_edit_post/:id", ensureAuthenticated, async (req, res) => {
  // 수정완료 버튼 누르면
  try {
    await db
      .collection("OWunWan")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: { title: req.body.title, content: req.body.content } });

    res.redirect("/OWunWan");
  } catch (error) {
    console.log(error);
    res.status(400).send("DB오류");
  }
});

app.delete("/OWunWan_delete/:id", ensureAuthenticated, async (req, res) => {
  //삭제하기

  await db.collection("OWunWan").deleteOne({ _id: new ObjectId(req.params.id), user: req.user._id });
  res.redirect("/OWunWan");
});

//자세 봐주세요 게시판

app.get("/PostureQnA/:page", ensureAuthenticated, async (req, res) => {
  //자세 봐주세요 게시글목록
  let pageCount = await db.collection("PostureQnA").countDocuments();
  let totalPage = Math.ceil(pageCount / 8);
  let result = await db
    .collection("PostureQnA")
    .find()
    .sort({ date: -1 })
    .skip((req.params.page - 1) * 8)
    .limit(8)
    .toArray();

  res.render("PostureQnA.ejs", { result: result, totalPage: totalPage, userId: req.user._id });
});

app.get("/PostureQnA", (req, res) => {
  res.redirect("/PostureQnA/1");
});

app.get("/PostureQnAWrite", ensureAuthenticated, async (req, res) => {
  //자세 봐주세요 게시물 작성
  res.render("PostureQnAWrite.ejs");
});

app.post("/PostureQnA_post", ensureAuthenticated, async (req, res) => {
  upload.array("img", 4)(req, res, async (err) => {
    if (err) return res.send("이미지 업로드 중 에러가 발생했습니다.");

    try {
      let imgUrl = [];
      for (let i = 0; i < req.files.length; i++) {
        imgUrl.push(req.files[i].location);
      }
      if (req.body.title === "") {
        res.send("제목을 입력해주세요");
      } else {
        //제목이 입력되었을때만 저장
        await db.collection("PostureQnA").insertOne({
          title: req.body.title,
          content: req.body.content,
          user: req.user._id,
          username: req.user.username,
          nickname: req.user.nickname,
          imgUrl: imgUrl,
          date: new Date(),
        });
        res.redirect("/PostureQnA");
      }
    } catch (error) {
      res.send("DB error!");
    }
  });
});

app.get("/PostureQnA/detail/:id", ensureAuthenticated, async (req, res) => {
  // 자세 봐주세요 상세페이지
  try {
    let result = await db.collection("PostureQnA").findOne({ _id: new ObjectId(req.params.id) });
    let comment = await db.collection("comment").find({ parentId: req.params.id }).toArray();

    if (result == null) {
      res.status(400).send("존재하지 않는 URL 입니다.");
    } else {
      res.render("PostureQnADetail.ejs", { result: result, comment: comment });
    }
  } catch (error) {
    console.log(error);
    res.status(400).send("존재하지 않는 URL 입니다.");
  }
});

app.get("/PostureQnA_edit/:id", ensureAuthenticated, async (req, res) => {
  //수정할 게시글 불러오기
  let result = await db.collection("PostureQnA").findOne({ _id: new ObjectId(req.params.id) });
  res.render("PostureQnA_edit.ejs", { result: result });
});

app.put("/PostureQnA_edit_post/:id", ensureAuthenticated, async (req, res) => {
  // 수정완료 버튼 누르면
  try {
    await db
      .collection("PostureQnA")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: { title: req.body.title, content: req.body.content } });

    res.redirect("/PostureQnA");
  } catch (error) {
    console.log(error);
    res.status(400).send("DB오류");
  }
});

app.delete("/PostureQnA_delete/:id", ensureAuthenticated, async (req, res) => {
  //삭제하기
  await db.collection("PostureQnA").deleteOne({ _id: new ObjectId(req.params.id) });
  res.redirect("/PostureQnA");
});

passport.use(
  new LocalStrategy(async (ID, PW, cb) => {
    let result = await db.collection("user").findOne({ username: ID });
    if (!result) {
      return cb(null, false, { message: "존재하지 않는 ID입니다." });
    }
    if (await bcrypt.compare(PW, result.password)) {
      return cb(null, result);
    } else {
      return cb(null, false, { message: "비밀번호가 일치하지 않습니다." });
    }
  })
);

passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username });
  });
});

passport.deserializeUser(async (user, done) => {
  let result = await db.collection("user").findOne({ _id: new ObjectId(user.id) });
  delete result.password;
  process.nextTick(() => {
    return done(null, result);
  });
});

app.get("/login", async (req, res) => {
  res.render("login.ejs");
});

app.post("/login", async (req, res, next) => {
  passport.authenticate("local", (error, user, info) => {
    //로그인에 대한 응답 파라미터
    if (error) return res.status(500).json(error);
    if (!user) return res.status(401).json(info.message);
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.redirect("/");
    });
  })(req, res, next);
});

app.get("/join", async (req, res) => {
  res.render("join.ejs");
});

app.post("/join", async (req, res) => {
  let ID = req.body.username;
  let PW1 = req.body.password;
  let PW2 = req.body.password2;
  let nickname = req.body.nickname;

  let result = await db.collection("user").findOne({ username: ID });
  let result2 = await db.collection("user").findOne({ nickname: nickname });

  if (result) {
    //중복 아이디 방지
    return res.send('<script>alert("이미 존재하는 ID 입니다."); location.href="/join";</script>');
  }
  if (result2) {
    //중복 아이디 방지
    return res.send('<script>alert("이미 존재하는 닉네임 입니다."); location.href="/join";</script>');
  }

  if (ID.length < 4 || PW1.length < 4) {
    //최소 자릿수 설정
    return res.send('<script>alert("아이디/패스워드를 4자 이상 설정해주세요."); location.href="/join";</script>');
  }

  if (PW1 === PW2) {
    let hash = await bcrypt.hash(req.body.password, 12);
    await db.collection("user").insertOne({
      username: req.body.username,
      nickname: nickname,
      password: hash,
    });
    return res.send('<script>alert("회원가입이 완료되었습니다."); location.href="/";</script>');
  } else {
    return res.send('<script>alert("비밀번호가 일치하지 않습니다."); location.href="/join";</script>');
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.send('<script>alert("로그인이 필요합니다. 로그인 페이지로 이동합니다."); location.href="/login";</script>');
}

app.post("/comment", ensureAuthenticated, async (req, res) => {
  let comment = req.body.comment;
  let parentId = req.body.parentId;
  let userId = req.user._id;
  let username = req.user.username;
  let nickname = req.user.nickname;

  await db
    .collection("comment")
    .insertOne({ comment: comment, parentId: parentId, userId: userId, username: username, nickname: nickname });
  res.redirect("back");
});

app.get("/deleteComment", ensureAuthenticated, async (req, res) => {
  let IdVer = await db
    .collection("comment")
    .findOne({ _id: new ObjectId(req.query.docid), userId: new ObjectId(req.user._id) });

  if (IdVer) {
    await db
      .collection("comment")
      .deleteOne({ _id: new ObjectId(req.query.docid), userId: new ObjectId(req.user._id) });
    res.redirect("back");
  } else {
    res.send('<script>alert("본인의 글만 삭제할 수 있습니다."); history.back();</script>');
  }
});
