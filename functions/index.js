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
    console.log("SVG生成処理を開始します (32x32画像ピン版)");

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

      // ピン画像のURL
      const rawUrl =
        "https://firebasestorage.googleapis.com/v0/b/denlabo-svgmap-exp.firebasestorage.app/o/mappin.png?alt=media";
      const pinUrl = rawUrl.replace(/&/g, "&amp;");

      // 画像タグに置換 (32x32 に合わせて調整)
      // width="32" height="32"
      // x="-16" (中心合わせ)
      // y="-32" (底辺合わせ：画像が座標の上に立つようにする)
      svgData = svgData.replace(
        /<image xlink:href="mappin.*?"[^>]*?>/g,
        `<image xlink:href="${pinUrl}" width="32" height="32" x="-16" y="-32" preserveAspectRatio="none" pointer-events="all" cursor="pointer" />`
      );

      console.log("SVG内の画像を32pxピンに置換しました");

      // 保存
      const bucket = storage.bucket();
      const file = bucket.file("layer_sightings.svg");
      await file.save(svgData, {
        contentType: "image/svg+xml",
        metadata: { cacheControl: "public, max-age=60" },
      });

      console.log("保存完了");
    } catch (error) {
      console.error("エラー:", error.message);
    }
  }
);
