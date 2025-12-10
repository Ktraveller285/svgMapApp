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
    console.log("SVG生成処理を開始します (リンク列追加・解決版)");

    try {
      const snapshot = await db.collection("sightings").get();
      if (snapshot.empty) {
        console.log("データが存在しません。");
        return;
      }

      // CSV配列
      const rows = [];

      // ★ヘッダー: 5列構成にします (ローカル成功パターン)
      // latitude, longitude, sightedAt, comment, link
      rows.push("latitude,longitude,sightedAt,comment,link");

      snapshot.forEach((doc) => {
        const data = doc.data();
        const lat = data.latitude;
        const lon = data.longitude;

        if (typeof lat !== "number" || typeof lon !== "number") return;

        // コメント整形
        let comment = (data.comment || "").replace(/[\r\n,]/g, " ").trim();
        if (!comment) comment = "-";

        // 日時生成
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

        // ★データ行: 最後にダミーリンク "#" を追加
        rows.push(`${lat},${lon},${dateStr},${comment},#`);
      });

      // 配列を結合 (BOMなし)
      const csvContent = rows.join("\r\n");

      console.log("生成CSV:");
      console.log(csvContent);

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

      console.log("SVG生成成功 (サイズ: " + apiResponse.data.length + ")");

      const bucket = storage.bucket();
      const file = bucket.file("layer_sightings.svg");
      await file.save(apiResponse.data, {
        contentType: "image/svg+xml",
        metadata: { cacheControl: "public, max-age=60" },
      });

      console.log("保存完了");
    } catch (error) {
      console.error("エラー:", error.message);
      if (error.response) {
        console.error("APIレスポンス:", error.response.data);
      }
    }
  }
);
