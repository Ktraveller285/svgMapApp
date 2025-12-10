const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const axios = require("axios");
const FormData = require("form-data");

initializeApp();
const db = getFirestore();
const storage = getStorage();

exports.generateMapLayer = onDocumentCreated(
  "sightings/{docId}",
  async (event) => {
    console.log("SVG生成処理を開始します (ピン画像→赤丸置換版)");

    try {
      const snapshot = await db.collection("sightings").get();
      if (snapshot.empty) return;

      const rows = [];
      // ヘッダー (5列)
      rows.push("latitude,longitude,sightedAt,comment,link");

      snapshot.forEach((doc) => {
        const data = doc.data();
        const lat = data.latitude;
        const lon = data.longitude;

        if (typeof lat !== "number" || typeof lon !== "number") return;

        let comment = (data.comment || "").replace(/[\r\n,]/g, " ").trim();
        if (!comment) comment = "-";

        let d;
        if (data.sightedAt && data.sightedAt.toDate) {
          d = data.sightedAt.toDate();
        } else {
          d = new Date();
        }
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        const yyyy = jst.getUTCFullYear();
        const mm = ("0" + (jst.getUTCMonth() + 1)).slice(-2);
        const dd = ("0" + jst.getUTCDate()).slice(-2);
        const HH = ("0" + jst.getUTCHours()).slice(-2);
        const MM = ("0" + jst.getUTCMinutes()).slice(-2);
        const SS = ("0" + jst.getUTCSeconds()).slice(-2);
        const dateStr = `${yyyy}/${mm}/${dd} ${HH}:${MM}:${SS}`;

        rows.push(`${lat},${lon},${dateStr},${comment},#`);
      });

      const csvContent = rows.join("\r\n");

      // APIへ送信
      const apiUrl =
        "https://svgmaptools-api-74174609992.us-west1.run.app/shape2svgmap";
      const form = new FormData();
      form.append("csv", Buffer.from(csvContent, "utf-8"), {
        filename: "data.csv",
        contentType: "text/csv",
      });

      const formLength = await new Promise((resolve, reject) => {
        form.getLength((err, length) => {
          if (err) reject(err);
          else resolve(length);
        });
      });

      console.log(`送信中 (Length: ${formLength})...`);

      const apiResponse = await axios.post(apiUrl, form, {
        headers: { ...form.getHeaders(), "Content-Length": formLength },
        responseType: "text",
      });

      // ★★★ ここでSVGの中身を書き換えます ★★★
      let svgData = apiResponse.data;

      // <image ... mappin.png ... /> というタグを全て探し、
      // <circle ... /> (赤い丸) に置換します。
      // ※ 半径(r)は地図の縮尺に合わせて調整が必要
      svgData = svgData.replace(
        /<image xlink:href="mappin.*?"[^>]*?>/g,
        '<circle cx="0" cy="0" r="5" fill="red" stroke="white" stroke-width="2" />'
      );

      console.log("SVG内の画像を赤丸に置換しました");

      // 保存
      const bucket = storage.bucket();
      const file = bucket.file("layer_sightings.svg");
      await file.save(svgData, {
        // 書き換えた svgData を保存
        contentType: "image/svg+xml",
        metadata: { cacheControl: "public, max-age=60" },
      });

      console.log("保存完了");
    } catch (error) {
      console.error("エラー:", error.message);
    }
  }
);
