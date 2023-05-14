import Log from "@/tryImportMe/server/index.js";
import * as alt from "alt-server";

setTimeout(() => Log());

alt.on("playerConnect", (player) => {
  player.model = "mp_m_freemode_01";
  player.spawn(new alt.Vector3(897.7318725585938, -1054.6944580078125, 32.818359375));
  alt.log(`Пользователь ~y~${player.name}~w~ зашёл на сервер.`);
});
