//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
}, n = "atlas-foundry", r = `module.${n}`, i = [
	"characters",
	"locations",
	"creatures",
	"items",
	"lore",
	"notes",
	"quests",
	"organizations",
	"cultures",
	"session-logs",
	"chronicles",
	"calendars"
], a = {
	characters: "fa-solid fa-user",
	locations: "fa-solid fa-map-location-dot",
	creatures: "fa-solid fa-dragon",
	items: "fa-solid fa-box",
	lore: "fa-solid fa-book-open",
	notes: "fa-solid fa-note-sticky",
	quests: "fa-solid fa-scroll",
	organizations: "fa-solid fa-users",
	cultures: "fa-solid fa-globe",
	"session-logs": "fa-solid fa-clipboard-list",
	chronicles: "fa-solid fa-timeline",
	calendars: "fa-solid fa-calendar-days"
};
//#endregion
//#region src/i18n.ts
function o(e, t) {
	return t ? game.i18n.format(e, t) : game.i18n.localize(e);
}
//#endregion
//#region src/settings.ts
var s = "integrationToken";
function c(e) {
	return e.trim().replace(/\/+$/, "");
}
function l(e) {
	let t = c(e);
	return t && !/^https?:\/\//i.test(t) ? {
		normalized: t,
		warningKey: "ATLASFOUNDRY.Settings.BaseUrlMissingScheme"
	} : { normalized: t };
}
function u() {
	game.settings.register(n, "baseUrl", {
		name: "ATLASFOUNDRY.Settings.BaseUrl.Name",
		hint: "ATLASFOUNDRY.Settings.BaseUrl.Hint",
		scope: "world",
		config: !1,
		type: String,
		default: "",
		onChange: () => Hooks.callAll("atlas-foundry.baseUrlChanged")
	}), game.settings.register(n, "campaignId", {
		name: "ATLASFOUNDRY.Settings.CampaignId.Name",
		scope: "world",
		config: !1,
		type: String,
		default: ""
	}), game.settings.register(n, s, {
		scope: "world",
		config: !1,
		type: String,
		default: ""
	}), game.settings.register(n, "userToken", {
		scope: "client",
		config: !1,
		type: String,
		default: ""
	}), game.settings.register(n, "userTokenId", {
		scope: "client",
		config: !1,
		type: String,
		default: ""
	}), game.settings.register(n, "showSceneLinks", {
		name: "ATLASFOUNDRY.Settings.ShowSceneLinks.Name",
		hint: "ATLASFOUNDRY.Settings.ShowSceneLinks.Hint",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !0,
		onChange: () => Hooks.callAll("atlas-foundry.showSceneLinksChanged")
	}), game.settings.register(n, "questPanelPosition", {
		scope: "client",
		config: !1,
		type: Object,
		default: {}
	}), game.settings.register(n, "quietMode", {
		name: "ATLASFOUNDRY.Settings.QuietMode.Name",
		hint: "ATLASFOUNDRY.Settings.QuietMode.Hint",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !1
	}), game.settings.register(n, "autoOpenGmSuggestions", {
		name: "ATLASFOUNDRY.Settings.AutoOpenGmSuggestions.Name",
		hint: "ATLASFOUNDRY.Settings.AutoOpenGmSuggestions.Hint",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !1
	}), game.settings.register(n, "showBell", {
		name: "ATLASFOUNDRY.Settings.ShowBell.Name",
		hint: "ATLASFOUNDRY.Settings.ShowBell.Hint",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !0,
		onChange: () => Hooks.callAll("atlas-foundry.showBellChanged")
	});
}
function d() {
	return game.settings.get("atlas-foundry", "baseUrl") ?? "";
}
async function ee(e) {
	await game.settings.set(n, "baseUrl", c(e));
}
function f() {
	return game.settings.get("atlas-foundry", "campaignId") ?? "";
}
async function te(e) {
	await game.settings.set(n, "campaignId", e);
}
function ne() {
	return game.settings.get("atlas-foundry", "userToken") ?? "";
}
function re() {
	return game.settings.get("atlas-foundry", "userTokenId") ?? "";
}
async function ie(e, t) {
	await game.settings.set(n, "userToken", e), await game.settings.set(n, "userTokenId", t);
}
function ae() {
	return game.settings.get("atlas-foundry", "showSceneLinks") ?? !0;
}
function oe() {
	return game.settings.get("atlas-foundry", "questPanelPosition") ?? {};
}
async function se(e) {
	await game.settings.set(n, "questPanelPosition", e);
}
function ce() {
	return game.settings.get("atlas-foundry", "quietMode") ?? !1;
}
function le() {
	return game.settings.get("atlas-foundry", "autoOpenGmSuggestions") ?? !1;
}
function ue() {
	return game.settings.get("atlas-foundry", "showBell") ?? !0;
}
async function de() {
	await game.settings.set(n, "userToken", ""), await game.settings.set(n, "userTokenId", "");
}
async function fe() {
	game.user.isGM && game.settings.get("atlas-foundry", s) && (await game.settings.set(n, s, ""), ui.notifications.warn(o("ATLASFOUNDRY.Settings.LegacyTokenMigrated")));
}
//#endregion
//#region src/controls.ts
function pe(e) {
	Hooks.on("getSceneControlButtons", (t) => {
		let n = t.tokens;
		n?.tools && (n.tools.atlasSearch = {
			name: "atlasSearch",
			title: "ATLASFOUNDRY.Controls.OpenSearch",
			icon: "fa-solid fa-search",
			button: !0,
			order: 100,
			onChange: () => e()
		});
	});
}
//#endregion
//#region src/connection-test.ts
var me = 5e3;
async function he(e) {
	let t = c(e);
	if (!t) return {
		ok: !1,
		messageKey: "ATLASFOUNDRY.ConnectionTest.MissingBaseUrl"
	};
	let n = new AbortController(), r = setTimeout(() => n.abort(), me);
	try {
		let e = await fetch(`${t}/api/v1/health`, {
			method: "GET",
			signal: n.signal
		});
		return e.status === 404 ? {
			ok: !1,
			messageKey: "ATLASFOUNDRY.ConnectionTest.NotFound"
		} : e.ok ? (await e.json()).status === "ok" ? {
			ok: !0,
			messageKey: "ATLASFOUNDRY.ConnectionTest.Success"
		} : {
			ok: !1,
			messageKey: "ATLASFOUNDRY.ConnectionTest.UnexpectedResponse"
		} : {
			ok: !1,
			messageKey: "ATLASFOUNDRY.ConnectionTest.HttpError",
			messageData: { status: e.status }
		};
	} catch (e) {
		return e instanceof DOMException && e.name === "AbortError" ? {
			ok: !1,
			messageKey: "ATLASFOUNDRY.ConnectionTest.Timeout"
		} : {
			ok: !1,
			messageKey: "ATLASFOUNDRY.ConnectionTest.NetworkOrCors",
			messageData: { detail: e instanceof Error ? e.message : String(e) }
		};
	} finally {
		clearTimeout(r);
	}
}
function ge(e) {
	return o(e.messageKey, e.messageData);
}
//#endregion
//#region src/log.ts
var _e = "Atlas Foundry |", p = {
	info(e, ...t) {
		console.info(_e, e, ...t);
	},
	warn(e, ...t) {
		console.warn(_e, e, ...t);
	},
	error(e, ...t) {
		console.error(_e, e, ...t);
	}
};
function m(e, t, n) {
	p.error(t, e), ui.notifications.error(o(t, n));
}
//#endregion
//#region src/auth/auth-manager.ts
var ve = 6e4, h = new class {
	state = "loggedOut";
	cachedJwt = null;
	me = null;
	sessionCampaignId = null;
	exchangePromise = null;
	revokedReason = "revoked";
	getState() {
		return this.state;
	}
	getRevokedReason() {
		return this.revokedReason;
	}
	getMe() {
		return this.me;
	}
	getLinkedCampaignId() {
		return this.sessionCampaignId;
	}
	isLinked() {
		return !!ne();
	}
	setLinking(e) {
		e ? this.setState("linking") : this.state === "linking" && this.setState("loggedOut");
	}
	async restore() {
		if (!ne()) {
			this.setState("loggedOut");
			return;
		}
		try {
			await this.ensureAccessToken();
		} catch (e) {
			p.warn("Atlas Foundry: failed to restore session", e);
		}
	}
	async login(e, t) {
		await ie(e, t), this.cachedJwt = null, await this.ensureAccessToken();
	}
	async logout() {
		let e = re(), t = await this.ensureAccessToken().catch(() => null);
		if (await de(), this.cachedJwt = null, this.me = null, this.sessionCampaignId = null, this.setState("loggedOut"), e) {
			if (!t) {
				ui.notifications.warn(o("ATLASFOUNDRY.Auth.LogoutOfflineHint"));
				return;
			}
			try {
				await this.revokeOnServer(e, t);
			} catch (e) {
				p.warn("Atlas Foundry: server-side token revoke failed", e), ui.notifications.warn(o("ATLASFOUNDRY.Auth.LogoutOfflineHint"));
			}
		}
	}
	invalidateCache() {
		this.cachedJwt = null;
	}
	async ensureAccessToken() {
		let e = ne();
		if (!e) throw this.state !== "revoked" && this.setState("loggedOut"), Error("Atlas Foundry: not logged in");
		return this.cachedJwt && this.cachedJwt.expiresAt - Date.now() > ve ? this.cachedJwt.token : (this.exchangePromise ||= this.exchange(e).finally(() => {
			this.exchangePromise = null;
		}), this.exchangePromise);
	}
	async exchange(e) {
		let t = d();
		if (!t) throw Error("Atlas Foundry: base URL not configured");
		let n = await fetch(`${t}/api/v1/foundry/token-exchange`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				token: e,
				worldId: game.world.id
			})
		});
		if (n.status === 401) {
			let e = await n.json().catch(() => null);
			throw this.revokedReason = e?.message?.toLowerCase().includes("world mismatch") ? "world-mismatch" : "revoked", await de(), this.cachedJwt = null, this.me = null, this.sessionCampaignId = null, this.setState("revoked"), Error("Atlas Foundry: token revoked, expired, or world mismatch");
		}
		if (!n.ok) throw Error(`Atlas Foundry: token exchange failed (HTTP ${n.status})`);
		let r = await n.json();
		return this.cachedJwt = {
			token: r.accessToken,
			expiresAt: Date.now() + r.expiresIn * 1e3
		}, this.sessionCampaignId = r.campaignId, this.setState("active"), await this.refreshMe(r.accessToken).catch((e) => p.warn("Atlas Foundry: failed to refresh /foundry/me", e)), r.accessToken;
	}
	async refreshMe(e) {
		let t = d(), n = await fetch(`${t}/api/v1/foundry/me`, { headers: { Authorization: `Bearer ${e}` } });
		if (!n.ok) return;
		let r = await n.json();
		this.me = r, this.checkCampaignConsistency(r), this.notifyChange();
	}
	checkCampaignConsistency(e) {
		let t = f();
		t && e.campaignId && t !== e.campaignId && ui.notifications.warn(o("ATLASFOUNDRY.Auth.CampaignMismatch", { campaignName: e.campaignName }));
	}
	async revokeOnServer(e, t) {
		let n = d(), r = await fetch(`${n}/api/v1/users/me/foundry-tokens/${encodeURIComponent(e)}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${t}` }
		});
		if (!r.ok) throw Error(`Atlas Foundry: server-side revoke failed (HTTP ${r.status})`);
	}
	setState(e) {
		this.state !== e && (this.state = e, this.notifyChange());
	}
	notifyChange() {
		Hooks.callAll("atlas-foundry.authChanged", {
			state: this.state,
			me: this.me
		});
	}
}();
async function ye(e, t) {
	let n = d();
	if (n) try {
		let r = await fetch(`${n}/api/v1/foundry/token-exchange`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				token: e,
				worldId: game.world.id
			})
		});
		if (!r.ok) return;
		let { accessToken: i } = await r.json();
		await fetch(`${n}/api/v1/users/me/foundry-tokens/${encodeURIComponent(t)}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${i}` }
		});
	} catch (e) {
		p.warn("Atlas Foundry: failed to revoke a rejected device token", e);
	}
}
//#endregion
//#region src/auth/device-flow.ts
async function be(e) {
	let t = d();
	if (!t) throw Error("Atlas Foundry: base URL not configured");
	let n = await fetch(`${t}/api/v1/foundry/device/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(e)
	});
	if (!n.ok) throw Error(`Atlas Foundry: device/start failed (HTTP ${n.status})`);
	return await n.json();
}
async function xe(e, t) {
	let n = d(), r = await fetch(`${n}/api/v1/foundry/device/poll`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ deviceCode: e }),
		signal: t
	});
	if (!r.ok) throw Error(`Atlas Foundry: device/poll failed (HTTP ${r.status})`);
	return await r.json();
}
function Se(e, t) {
	return new Promise((n, r) => {
		if (t.aborted) {
			r(new DOMException("Aborted", "AbortError"));
			return;
		}
		let i = setTimeout(n, e);
		t.addEventListener("abort", () => {
			clearTimeout(i), r(new DOMException("Aborted", "AbortError"));
		}, { once: !0 });
	});
}
async function Ce(e, t) {
	let n = e.interval * 1e3, r = Date.now() + e.expiresIn * 1e3;
	for (;;) {
		if (Date.now() >= r) return { status: "expired" };
		await Se(n, t);
		let i;
		try {
			i = await xe(e.deviceCode, t);
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") throw e;
			continue;
		}
		if (i.status !== "pending") {
			if (i.status === "slow_down") {
				n += 5e3;
				continue;
			}
			return i;
		}
	}
}
//#endregion
//#region src/auth/login-app.ts
function we(e) {
	return `
    <div class="atlas-foundry-login">
      <p>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Login.Instructions"))}</p>
      <p class="atlas-foundry-login-code">${foundry.utils.escapeHTML(e.userCode)}</p>
      <button type="button" data-action="open-atlas">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Login.OpenAtlas"))}</button>
      <p class="hint">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Login.FallbackLinkHint"))}</p>
      <input type="text" readonly value="${foundry.utils.escapeHTML(e.verificationUriComplete)}" data-fallback-link>
      <p class="atlas-foundry-status" data-login-status>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Login.Waiting"))}</p>
    </div>
  `;
}
async function g() {
	if (!game.user.isGM && !f()) {
		ui.notifications.warn(o("ATLASFOUNDRY.Login.PlayerWaitingForGm"));
		return;
	}
	let e;
	try {
		e = await be({
			worldId: game.world.id,
			worldName: game.world.title,
			campaignId: f() || void 0,
			foundryUserName: game.user.name
		});
	} catch (e) {
		m(e, "ATLASFOUNDRY.Login.StartFailed");
		return;
	}
	h.setLinking(!0);
	let t = new AbortController();
	try {
		await foundry.applications.api.DialogV2.prompt({
			window: { title: "ATLASFOUNDRY.Login.Title" },
			content: we(e),
			buttons: [{
				label: "ATLASFOUNDRY.Login.Cancel",
				action: "cancel",
				callback: () => t.abort()
			}],
			render: (n, r) => {
				r.element.querySelector("[data-action=\"open-atlas\"]")?.addEventListener("click", () => {
					window.open(e.verificationUriComplete, "_blank") || ui.notifications.warn(o("ATLASFOUNDRY.Login.PopupBlocked"));
				}), Te(e, t.signal, r).catch((e) => {
					e instanceof DOMException && e.name === "AbortError" || p.error("Atlas Foundry: login poll loop failed", e);
				});
			}
		});
	} finally {
		h.setLinking(!1);
	}
}
async function Te(e, t, n) {
	let r = await Ce(e, t);
	if (await n.close(), r.status === "denied") {
		ui.notifications.warn(o("ATLASFOUNDRY.Login.Denied"));
		return;
	}
	if (r.status === "expired") {
		ui.notifications.warn(o("ATLASFOUNDRY.Login.Expired"));
		return;
	}
	let i = f();
	if (i && i !== r.campaignId) {
		ye(r.token, r.tokenId), ui.notifications.error(o("ATLASFOUNDRY.Login.CampaignMismatch"));
		return;
	}
	!i && game.user.isGM && await te(r.campaignId);
	try {
		await h.login(r.token, r.tokenId);
	} catch (e) {
		m(e, "ATLASFOUNDRY.Login.ExchangeFailed");
		return;
	}
	let a = h.getMe();
	ui.notifications.info(o("ATLASFOUNDRY.Login.Success", {
		displayName: a?.displayName ?? "",
		campaignName: a?.campaignName ?? ""
	}));
}
//#endregion
//#region node_modules/engine.io-parser/build/esm/commons.js
var _ = Object.create(null);
_.open = "0", _.close = "1", _.ping = "2", _.pong = "3", _.message = "4", _.upgrade = "5", _.noop = "6";
var Ee = Object.create(null);
Object.keys(_).forEach((e) => {
	Ee[_[e]] = e;
});
var De = {
	type: "error",
	data: "parser error"
}, Oe = typeof Blob == "function" || typeof Blob < "u" && Object.prototype.toString.call(Blob) === "[object BlobConstructor]", ke = typeof ArrayBuffer == "function", Ae = (e) => typeof ArrayBuffer.isView == "function" ? ArrayBuffer.isView(e) : e && e.buffer instanceof ArrayBuffer, je = ({ type: e, data: t }, n, r) => Oe && t instanceof Blob ? n ? r(t) : Me(t, r) : ke && (t instanceof ArrayBuffer || Ae(t)) ? n ? r(t) : Me(new Blob([t]), r) : r(_[e] + (t || "")), Me = (e, t) => {
	let n = new FileReader();
	return n.onload = function() {
		let e = n.result.split(",")[1];
		t("b" + (e || ""));
	}, n.readAsDataURL(e);
};
function Ne(e) {
	return e instanceof Uint8Array ? e : e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
}
var Pe;
function Fe(e, t) {
	if (Oe && e.data instanceof Blob) return e.data.arrayBuffer().then(Ne).then(t);
	if (ke && (e.data instanceof ArrayBuffer || Ae(e.data))) return t(Ne(e.data));
	je(e, !1, (e) => {
		Pe ||= new TextEncoder(), t(Pe.encode(e));
	});
}
//#endregion
//#region node_modules/engine.io-parser/build/esm/contrib/base64-arraybuffer.js
var Ie = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", v = typeof Uint8Array > "u" ? [] : /* @__PURE__ */ new Uint8Array(256);
for (let e = 0; e < 64; e++) v[Ie.charCodeAt(e)] = e;
var Le = (e) => {
	let t = e.length * .75, n = e.length, r, i = 0, a, o, s, c;
	e[e.length - 1] === "=" && (t--, e[e.length - 2] === "=" && t--);
	let l = new ArrayBuffer(t), u = new Uint8Array(l);
	for (r = 0; r < n; r += 4) a = v[e.charCodeAt(r)], o = v[e.charCodeAt(r + 1)], s = v[e.charCodeAt(r + 2)], c = v[e.charCodeAt(r + 3)], u[i++] = a << 2 | o >> 4, u[i++] = (o & 15) << 4 | s >> 2, u[i++] = (s & 3) << 6 | c & 63;
	return l;
}, Re = typeof ArrayBuffer == "function", ze = (e, t) => {
	if (typeof e != "string") return {
		type: "message",
		data: Ve(e, t)
	};
	let n = e.charAt(0);
	return n === "b" ? {
		type: "message",
		data: Be(e.substring(1), t)
	} : Ee[n] ? e.length > 1 ? {
		type: Ee[n],
		data: e.substring(1)
	} : { type: Ee[n] } : De;
}, Be = (e, t) => Re ? Ve(Le(e), t) : {
	base64: !0,
	data: e
}, Ve = (e, t) => {
	switch (t) {
		case "blob": return e instanceof Blob ? e : new Blob([e]);
		default: return e instanceof ArrayBuffer ? e : e.buffer;
	}
}, He = "", Ue = (e, t) => {
	let n = e.length, r = Array(n), i = 0;
	e.forEach((e, a) => {
		je(e, !1, (e) => {
			r[a] = e, ++i === n && t(r.join(He));
		});
	});
}, We = (e, t) => {
	let n = e.split(He), r = [];
	for (let e = 0; e < n.length; e++) {
		let i = ze(n[e], t);
		if (r.push(i), i.type === "error") break;
	}
	return r;
};
function Ge() {
	return new TransformStream({ transform(e, t) {
		Fe(e, (n) => {
			let r = n.length, i;
			if (r < 126) i = /* @__PURE__ */ new Uint8Array(1), new DataView(i.buffer).setUint8(0, r);
			else if (r < 65536) {
				i = /* @__PURE__ */ new Uint8Array(3);
				let e = new DataView(i.buffer);
				e.setUint8(0, 126), e.setUint16(1, r);
			} else {
				i = /* @__PURE__ */ new Uint8Array(9);
				let e = new DataView(i.buffer);
				e.setUint8(0, 127), e.setBigUint64(1, BigInt(r));
			}
			e.data && typeof e.data != "string" && (i[0] |= 128), t.enqueue(i), t.enqueue(n);
		});
	} });
}
var Ke;
function qe(e) {
	return e.reduce((e, t) => e + t.length, 0);
}
function y(e, t) {
	if (e[0].length === t) return e.shift();
	let n = new Uint8Array(t), r = 0;
	for (let i = 0; i < t; i++) n[i] = e[0][r++], r === e[0].length && (e.shift(), r = 0);
	return e.length && r < e[0].length && (e[0] = e[0].slice(r)), n;
}
function Je(e, t) {
	Ke ||= new TextDecoder();
	let n = [], r = 0, i = -1, a = !1;
	return new TransformStream({ transform(o, s) {
		for (n.push(o);;) {
			if (r === 0) {
				if (qe(n) < 1) break;
				let e = y(n, 1);
				a = (e[0] & 128) == 128, i = e[0] & 127, r = i < 126 ? 3 : i === 126 ? 1 : 2;
			} else if (r === 1) {
				if (qe(n) < 2) break;
				let e = y(n, 2);
				i = new DataView(e.buffer, e.byteOffset, e.length).getUint16(0), r = 3;
			} else if (r === 2) {
				if (qe(n) < 8) break;
				let e = y(n, 8), t = new DataView(e.buffer, e.byteOffset, e.length), a = t.getUint32(0);
				if (a > 2 ** 21 - 1) {
					s.enqueue(De);
					break;
				}
				i = a * 2 ** 32 + t.getUint32(4), r = 3;
			} else {
				if (qe(n) < i) break;
				let e = y(n, i);
				s.enqueue(ze(a ? e : Ke.decode(e), t)), r = 0;
			}
			if (i === 0 || i > e) {
				s.enqueue(De);
				break;
			}
		}
	} });
}
//#endregion
//#region node_modules/@socket.io/component-emitter/lib/esm/index.js
function b(e) {
	if (e) return Ye(e);
}
function Ye(e) {
	for (var t in b.prototype) e[t] = b.prototype[t];
	return e;
}
b.prototype.on = b.prototype.addEventListener = function(e, t) {
	return this._callbacks = this._callbacks || {}, (this._callbacks["$" + e] = this._callbacks["$" + e] || []).push(t), this;
}, b.prototype.once = function(e, t) {
	function n() {
		this.off(e, n), t.apply(this, arguments);
	}
	return n.fn = t, this.on(e, n), this;
}, b.prototype.off = b.prototype.removeListener = b.prototype.removeAllListeners = b.prototype.removeEventListener = function(e, t) {
	if (this._callbacks = this._callbacks || {}, arguments.length == 0) return this._callbacks = {}, this;
	var n = this._callbacks["$" + e];
	if (!n) return this;
	if (arguments.length == 1) return delete this._callbacks["$" + e], this;
	for (var r, i = 0; i < n.length; i++) if (r = n[i], r === t || r.fn === t) {
		n.splice(i, 1);
		break;
	}
	return n.length === 0 && delete this._callbacks["$" + e], this;
}, b.prototype.emit = function(e) {
	this._callbacks = this._callbacks || {};
	for (var t = Array(arguments.length - 1), n = this._callbacks["$" + e], r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
	if (n) {
		n = n.slice(0);
		for (var r = 0, i = n.length; r < i; ++r) n[r].apply(this, t);
	}
	return this;
}, b.prototype.emitReserved = b.prototype.emit, b.prototype.listeners = function(e) {
	return this._callbacks = this._callbacks || {}, this._callbacks["$" + e] || [];
}, b.prototype.hasListeners = function(e) {
	return !!this.listeners(e).length;
};
//#endregion
//#region node_modules/engine.io-client/build/esm/globals.js
var x = typeof Promise == "function" && typeof Promise.resolve == "function" ? (e) => Promise.resolve().then(e) : (e, t) => t(e, 0), S = typeof self < "u" ? self : typeof window < "u" ? window : Function("return this")(), Xe = "arraybuffer";
//#endregion
//#region node_modules/engine.io-client/build/esm/util.js
function Ze(e, ...t) {
	return t.reduce((t, n) => (e.hasOwnProperty(n) && (t[n] = e[n]), t), {});
}
var Qe = S.setTimeout, $e = S.clearTimeout;
function C(e, t) {
	t.useNativeTimers ? (e.setTimeoutFn = Qe.bind(S), e.clearTimeoutFn = $e.bind(S)) : (e.setTimeoutFn = S.setTimeout.bind(S), e.clearTimeoutFn = S.clearTimeout.bind(S));
}
var et = 1.33;
function tt(e) {
	return typeof e == "string" ? nt(e) : Math.ceil((e.byteLength || e.size) * et);
}
function nt(e) {
	let t = 0, n = 0;
	for (let r = 0, i = e.length; r < i; r++) t = e.charCodeAt(r), t < 128 ? n += 1 : t < 2048 ? n += 2 : t < 55296 || t >= 57344 ? n += 3 : (r++, n += 4);
	return n;
}
function rt() {
	return Date.now().toString(36).substring(3) + Math.random().toString(36).substring(2, 5);
}
//#endregion
//#region node_modules/engine.io-client/build/esm/contrib/parseqs.js
function it(e) {
	let t = "";
	for (let n in e) e.hasOwnProperty(n) && (t.length && (t += "&"), t += encodeURIComponent(n) + "=" + encodeURIComponent(e[n]));
	return t;
}
function at(e) {
	let t = {}, n = e.split("&");
	for (let e = 0, r = n.length; e < r; e++) {
		let r = n[e].split("=");
		t[decodeURIComponent(r[0])] = decodeURIComponent(r[1]);
	}
	return t;
}
//#endregion
//#region node_modules/engine.io-client/build/esm/transport.js
var ot = class extends Error {
	constructor(e, t, n) {
		super(e), this.description = t, this.context = n, this.type = "TransportError";
	}
}, st = class extends b {
	constructor(e) {
		super(), this.writable = !1, C(this, e), this.opts = e, this.query = e.query, this.socket = e.socket, this.supportsBinary = !e.forceBase64;
	}
	onError(e, t, n) {
		return super.emitReserved("error", new ot(e, t, n)), this;
	}
	open() {
		return this.readyState = "opening", this.doOpen(), this;
	}
	close() {
		return (this.readyState === "opening" || this.readyState === "open") && (this.doClose(), this.onClose()), this;
	}
	send(e) {
		this.readyState === "open" && this.write(e);
	}
	onOpen() {
		this.readyState = "open", this.writable = !0, super.emitReserved("open");
	}
	onData(e) {
		let t = ze(e, this.socket.binaryType);
		this.onPacket(t);
	}
	onPacket(e) {
		super.emitReserved("packet", e);
	}
	onClose(e) {
		this.readyState = "closed", super.emitReserved("close", e);
	}
	pause(e) {}
	createUri(e, t = {}) {
		return e + "://" + this._hostname() + this._port() + this.opts.path + this._query(t);
	}
	_hostname() {
		let e = this.opts.hostname;
		return e.indexOf(":") === -1 ? e : "[" + e + "]";
	}
	_port() {
		return this.opts.port && (this.opts.secure && Number(this.opts.port) !== 443 || !this.opts.secure && Number(this.opts.port) !== 80) ? ":" + this.opts.port : "";
	}
	_query(e) {
		let t = it(e);
		return t.length ? "?" + t : "";
	}
}, ct = class extends st {
	constructor() {
		super(...arguments), this._polling = !1;
	}
	get name() {
		return "polling";
	}
	doOpen() {
		this._poll();
	}
	pause(e) {
		this.readyState = "pausing";
		let t = () => {
			this.readyState = "paused", e();
		};
		if (this._polling || !this.writable) {
			let e = 0;
			this._polling && (e++, this.once("pollComplete", function() {
				--e || t();
			})), this.writable || (e++, this.once("drain", function() {
				--e || t();
			}));
		} else t();
	}
	_poll() {
		this._polling = !0, this.doPoll(), this.emitReserved("poll");
	}
	onData(e) {
		We(e, this.socket.binaryType).forEach((e) => {
			if (this.readyState === "opening" && e.type === "open" && this.onOpen(), e.type === "close") return this.onClose({ description: "transport closed by the server" }), !1;
			this.onPacket(e);
		}), this.readyState !== "closed" && (this._polling = !1, this.emitReserved("pollComplete"), this.readyState === "open" && this._poll());
	}
	doClose() {
		let e = () => {
			this.write([{ type: "close" }]);
		};
		this.readyState === "open" ? e() : this.once("open", e);
	}
	write(e) {
		this.writable = !1, Ue(e, (e) => {
			this.doWrite(e, () => {
				this.writable = !0, this.emitReserved("drain");
			});
		});
	}
	uri() {
		let e = this.opts.secure ? "https" : "http", t = this.query || {};
		return !1 !== this.opts.timestampRequests && (t[this.opts.timestampParam] = rt()), !this.supportsBinary && !t.sid && (t.b64 = 1), this.createUri(e, t);
	}
}, lt = !1;
try {
	lt = typeof XMLHttpRequest < "u" && "withCredentials" in new XMLHttpRequest();
} catch {}
var ut = lt;
//#endregion
//#region node_modules/engine.io-client/build/esm/transports/polling-xhr.js
function dt() {}
var ft = class extends ct {
	constructor(e) {
		if (super(e), typeof location < "u") {
			let t = location.protocol === "https:", n = location.port;
			n ||= t ? "443" : "80", this.xd = typeof location < "u" && e.hostname !== location.hostname || n !== e.port;
		}
	}
	doWrite(e, t) {
		let n = this.request({
			method: "POST",
			data: e
		});
		n.on("success", t), n.on("error", (e, t) => {
			this.onError("xhr post error", e, t);
		});
	}
	doPoll() {
		let e = this.request();
		e.on("data", this.onData.bind(this)), e.on("error", (e, t) => {
			this.onError("xhr poll error", e, t);
		}), this.pollXhr = e;
	}
}, w = class e extends b {
	constructor(e, t, n) {
		super(), this.createRequest = e, C(this, n), this._opts = n, this._method = n.method || "GET", this._uri = t, this._data = n.data === void 0 ? null : n.data, this._create();
	}
	_create() {
		var t;
		let n = Ze(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
		n.xdomain = !!this._opts.xd;
		let r = this._xhr = this.createRequest(n);
		try {
			r.open(this._method, this._uri, !0);
			try {
				if (this._opts.extraHeaders) {
					r.setDisableHeaderCheck && r.setDisableHeaderCheck(!0);
					for (let e in this._opts.extraHeaders) this._opts.extraHeaders.hasOwnProperty(e) && r.setRequestHeader(e, this._opts.extraHeaders[e]);
				}
			} catch {}
			if (this._method === "POST") try {
				r.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
			} catch {}
			try {
				r.setRequestHeader("Accept", "*/*");
			} catch {}
			(t = this._opts.cookieJar) == null || t.addCookies(r), "withCredentials" in r && (r.withCredentials = this._opts.withCredentials), this._opts.requestTimeout && (r.timeout = this._opts.requestTimeout), r.onreadystatechange = () => {
				var e;
				r.readyState === 3 && ((e = this._opts.cookieJar) == null || e.parseCookies(r.getResponseHeader("set-cookie"))), r.readyState === 4 && (r.status === 200 || r.status === 1223 ? this._onLoad() : this.setTimeoutFn(() => {
					this._onError(typeof r.status == "number" ? r.status : 0);
				}, 0));
			}, r.send(this._data);
		} catch (e) {
			this.setTimeoutFn(() => {
				this._onError(e);
			}, 0);
			return;
		}
		typeof document < "u" && (this._index = e.requestsCount++, e.requests[this._index] = this);
	}
	_onError(e) {
		this.emitReserved("error", e, this._xhr), this._cleanup(!0);
	}
	_cleanup(t) {
		if (!(this._xhr === void 0 || this._xhr === null)) {
			if (this._xhr.onreadystatechange = dt, t) try {
				this._xhr.abort();
			} catch {}
			typeof document < "u" && delete e.requests[this._index], this._xhr = null;
		}
	}
	_onLoad() {
		let e = this._xhr.responseText;
		e !== null && (this.emitReserved("data", e), this.emitReserved("success"), this._cleanup());
	}
	abort() {
		this._cleanup();
	}
};
if (w.requestsCount = 0, w.requests = {}, typeof document < "u") {
	if (typeof attachEvent == "function") attachEvent("onunload", pt);
	else if (typeof addEventListener == "function") {
		let e = "onpagehide" in S ? "pagehide" : "unload";
		addEventListener(e, pt, !1);
	}
}
function pt() {
	for (let e in w.requests) w.requests.hasOwnProperty(e) && w.requests[e].abort();
}
var mt = (function() {
	let e = gt({ xdomain: !1 });
	return e && e.responseType !== null;
})(), ht = class extends ft {
	constructor(e) {
		super(e);
		let t = e && e.forceBase64;
		this.supportsBinary = mt && !t;
	}
	request(e = {}) {
		return Object.assign(e, { xd: this.xd }, this.opts), new w(gt, this.uri(), e);
	}
};
function gt(e) {
	let t = e.xdomain;
	try {
		if (typeof XMLHttpRequest < "u" && (!t || ut)) return new XMLHttpRequest();
	} catch {}
	if (!t) try {
		return new S[["Active", "Object"].join("X")]("Microsoft.XMLHTTP");
	} catch {}
}
//#endregion
//#region node_modules/engine.io-client/build/esm/transports/websocket.js
var _t = typeof navigator < "u" && typeof navigator.product == "string" && navigator.product.toLowerCase() === "reactnative", vt = class extends st {
	get name() {
		return "websocket";
	}
	doOpen() {
		let e = this.uri(), t = this.opts.protocols, n = _t ? {} : Ze(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
		this.opts.extraHeaders && (n.headers = this.opts.extraHeaders);
		try {
			this.ws = this.createSocket(e, t, n);
		} catch (e) {
			return this.emitReserved("error", e);
		}
		this.ws.binaryType = this.socket.binaryType, this.addEventListeners();
	}
	addEventListeners() {
		this.ws.onopen = () => {
			this.opts.autoUnref && this.ws._socket.unref(), this.onOpen();
		}, this.ws.onclose = (e) => this.onClose({
			description: "websocket connection closed",
			context: e
		}), this.ws.onmessage = (e) => this.onData(e.data), this.ws.onerror = (e) => this.onError("websocket error", e);
	}
	write(e) {
		this.writable = !1;
		for (let t = 0; t < e.length; t++) {
			let n = e[t], r = t === e.length - 1;
			je(n, this.supportsBinary, (e) => {
				try {
					this.doWrite(n, e);
				} catch {}
				r && x(() => {
					this.writable = !0, this.emitReserved("drain");
				}, this.setTimeoutFn);
			});
		}
	}
	doClose() {
		this.ws !== void 0 && (this.ws.onerror = () => {}, this.ws.close(), this.ws = null);
	}
	uri() {
		let e = this.opts.secure ? "wss" : "ws", t = this.query || {};
		return this.opts.timestampRequests && (t[this.opts.timestampParam] = rt()), this.supportsBinary || (t.b64 = 1), this.createUri(e, t);
	}
}, yt = S.WebSocket || S.MozWebSocket, bt = {
	websocket: class extends vt {
		createSocket(e, t, n) {
			return _t ? new yt(e, t, n) : t ? new yt(e, t) : new yt(e);
		}
		doWrite(e, t) {
			this.ws.send(t);
		}
	},
	webtransport: class extends st {
		get name() {
			return "webtransport";
		}
		doOpen() {
			try {
				this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
			} catch (e) {
				return this.emitReserved("error", e);
			}
			this._transport.closed.then(() => {
				this.onClose();
			}).catch((e) => {
				this.onError("webtransport error", e);
			}), this._transport.ready.then(() => {
				this._transport.createBidirectionalStream().then((e) => {
					let t = Je(2 ** 53 - 1, this.socket.binaryType), n = e.readable.pipeThrough(t).getReader(), r = Ge();
					r.readable.pipeTo(e.writable), this._writer = r.writable.getWriter();
					let i = () => {
						n.read().then(({ done: e, value: t }) => {
							e || (this.onPacket(t), i());
						}).catch((e) => {});
					};
					i();
					let a = { type: "open" };
					this.query.sid && (a.data = `{"sid":"${this.query.sid}"}`), this._writer.write(a).then(() => this.onOpen());
				});
			});
		}
		write(e) {
			this.writable = !1;
			for (let t = 0; t < e.length; t++) {
				let n = e[t], r = t === e.length - 1;
				this._writer.write(n).then(() => {
					r && x(() => {
						this.writable = !0, this.emitReserved("drain");
					}, this.setTimeoutFn);
				});
			}
		}
		doClose() {
			var e;
			(e = this._transport) == null || e.close();
		}
	},
	polling: ht
}, xt = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/, St = [
	"source",
	"protocol",
	"authority",
	"userInfo",
	"user",
	"password",
	"host",
	"port",
	"relative",
	"path",
	"directory",
	"file",
	"query",
	"anchor"
];
function Ct(e) {
	if (e.length > 8e3) throw "URI too long";
	let t = e, n = e.indexOf("["), r = e.indexOf("]");
	n != -1 && r != -1 && (e = e.substring(0, n) + e.substring(n, r).replace(/:/g, ";") + e.substring(r, e.length));
	let i = xt.exec(e || ""), a = {}, o = 14;
	for (; o--;) a[St[o]] = i[o] || "";
	return n != -1 && r != -1 && (a.source = t, a.host = a.host.substring(1, a.host.length - 1).replace(/;/g, ":"), a.authority = a.authority.replace("[", "").replace("]", "").replace(/;/g, ":"), a.ipv6uri = !0), a.pathNames = wt(a, a.path), a.queryKey = Tt(a, a.query), a;
}
function wt(e, t) {
	let n = t.replace(/\/{2,9}/g, "/").split("/");
	return (t.slice(0, 1) == "/" || t.length === 0) && n.splice(0, 1), t.slice(-1) == "/" && n.splice(n.length - 1, 1), n;
}
function Tt(e, t) {
	let n = {};
	return t.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function(e, t, r) {
		t && (n[t] = r);
	}), n;
}
//#endregion
//#region node_modules/engine.io-client/build/esm/socket.js
var Et = typeof addEventListener == "function" && typeof removeEventListener == "function", Dt = [];
Et && addEventListener("offline", () => {
	Dt.forEach((e) => e());
}, !1);
var Ot = class e extends b {
	constructor(e, t) {
		if (super(), this.binaryType = Xe, this.writeBuffer = [], this._prevBufferLen = 0, this._pingInterval = -1, this._pingTimeout = -1, this._maxPayload = -1, this._pingTimeoutTime = Infinity, e && typeof e == "object" && (t = e, e = null), e) {
			let n = Ct(e);
			t.hostname = n.host, t.secure = n.protocol === "https" || n.protocol === "wss", t.port = n.port, n.query && (t.query = n.query);
		} else t.host && (t.hostname = Ct(t.host).host);
		C(this, t), this.secure = t.secure == null ? typeof location < "u" && location.protocol === "https:" : t.secure, t.hostname && !t.port && (t.port = this.secure ? "443" : "80"), this.hostname = t.hostname || (typeof location < "u" ? location.hostname : "localhost"), this.port = t.port || (typeof location < "u" && location.port ? location.port : this.secure ? "443" : "80"), this.transports = [], this._transportsByName = {}, t.transports.forEach((e) => {
			let t = e.prototype.name;
			this.transports.push(t), this._transportsByName[t] = e;
		}), this.opts = Object.assign({
			path: "/engine.io",
			agent: !1,
			withCredentials: !1,
			upgrade: !0,
			timestampParam: "t",
			rememberUpgrade: !1,
			addTrailingSlash: !0,
			rejectUnauthorized: !0,
			perMessageDeflate: { threshold: 1024 },
			transportOptions: {},
			closeOnBeforeunload: !1
		}, t), this.opts.path = this.opts.path.replace(/\/$/, "") + (this.opts.addTrailingSlash ? "/" : ""), typeof this.opts.query == "string" && (this.opts.query = at(this.opts.query)), Et && (this.opts.closeOnBeforeunload && (this._beforeunloadEventListener = () => {
			this.transport && (this.transport.removeAllListeners(), this.transport.close());
		}, addEventListener("beforeunload", this._beforeunloadEventListener, !1)), this.hostname !== "localhost" && (this._offlineEventListener = () => {
			this._onClose("transport close", { description: "network connection lost" });
		}, Dt.push(this._offlineEventListener))), this.opts.withCredentials && (this._cookieJar = void 0), this._open();
	}
	createTransport(e) {
		let t = Object.assign({}, this.opts.query);
		t.EIO = 4, t.transport = e, this.id && (t.sid = this.id);
		let n = Object.assign({}, this.opts, {
			query: t,
			socket: this,
			hostname: this.hostname,
			secure: this.secure,
			port: this.port
		}, this.opts.transportOptions[e]);
		return new this._transportsByName[e](n);
	}
	_open() {
		if (this.transports.length === 0) {
			this.setTimeoutFn(() => {
				this.emitReserved("error", "No transports available");
			}, 0);
			return;
		}
		let t = this.opts.rememberUpgrade && e.priorWebsocketSuccess && this.transports.indexOf("websocket") !== -1 ? "websocket" : this.transports[0];
		this.readyState = "opening";
		let n = this.createTransport(t);
		n.open(), this.setTransport(n);
	}
	setTransport(e) {
		this.transport && this.transport.removeAllListeners(), this.transport = e, e.on("drain", this._onDrain.bind(this)).on("packet", this._onPacket.bind(this)).on("error", this._onError.bind(this)).on("close", (e) => this._onClose("transport close", e));
	}
	onOpen() {
		this.readyState = "open", e.priorWebsocketSuccess = this.transport.name === "websocket", this.emitReserved("open"), this.flush();
	}
	_onPacket(e) {
		if (this.readyState === "opening" || this.readyState === "open" || this.readyState === "closing") switch (this.emitReserved("packet", e), this.emitReserved("heartbeat"), e.type) {
			case "open":
				this.onHandshake(JSON.parse(e.data));
				break;
			case "ping":
				this._sendPacket("pong"), this.emitReserved("ping"), this.emitReserved("pong"), this._resetPingTimeout();
				break;
			case "error":
				let t = /* @__PURE__ */ Error("server error");
				t.code = e.data, this._onError(t);
				break;
			case "message":
				this.emitReserved("data", e.data), this.emitReserved("message", e.data);
				break;
		}
	}
	onHandshake(e) {
		this.emitReserved("handshake", e), this.id = e.sid, this.transport.query.sid = e.sid, this._pingInterval = e.pingInterval, this._pingTimeout = e.pingTimeout, this._maxPayload = e.maxPayload, this.onOpen(), this.readyState !== "closed" && this._resetPingTimeout();
	}
	_resetPingTimeout() {
		this.clearTimeoutFn(this._pingTimeoutTimer);
		let e = this._pingInterval + this._pingTimeout;
		this._pingTimeoutTime = Date.now() + e, this._pingTimeoutTimer = this.setTimeoutFn(() => {
			this._onClose("ping timeout");
		}, e), this.opts.autoUnref && this._pingTimeoutTimer.unref();
	}
	_onDrain() {
		this.writeBuffer.splice(0, this._prevBufferLen), this._prevBufferLen = 0, this.writeBuffer.length === 0 ? this.emitReserved("drain") : this.flush();
	}
	flush() {
		if (this.readyState !== "closed" && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
			let e = this._getWritablePackets();
			this.transport.send(e), this._prevBufferLen = e.length, this.emitReserved("flush");
		}
	}
	_getWritablePackets() {
		if (!(this._maxPayload && this.transport.name === "polling" && this.writeBuffer.length > 1)) return this.writeBuffer;
		let e = 1;
		for (let t = 0; t < this.writeBuffer.length; t++) {
			let n = this.writeBuffer[t].data;
			if (n && (e += tt(n)), t > 0 && e > this._maxPayload) return this.writeBuffer.slice(0, t);
			e += 2;
		}
		return this.writeBuffer;
	}
	_hasPingExpired() {
		if (!this._pingTimeoutTime) return !0;
		let e = Date.now() > this._pingTimeoutTime;
		return e && (this._pingTimeoutTime = 0, x(() => {
			this._onClose("ping timeout");
		}, this.setTimeoutFn)), e;
	}
	write(e, t, n) {
		return this._sendPacket("message", e, t, n), this;
	}
	send(e, t, n) {
		return this._sendPacket("message", e, t, n), this;
	}
	_sendPacket(e, t, n, r) {
		if (typeof t == "function" && (r = t, t = void 0), typeof n == "function" && (r = n, n = null), this.readyState === "closing" || this.readyState === "closed") return;
		n ||= {}, n.compress = !1 !== n.compress;
		let i = {
			type: e,
			data: t,
			options: n
		};
		this.emitReserved("packetCreate", i), this.writeBuffer.push(i), r && this.once("flush", r), this.flush();
	}
	close() {
		let e = () => {
			this._onClose("forced close"), this.transport.close();
		}, t = () => {
			this.off("upgrade", t), this.off("upgradeError", t), e();
		}, n = () => {
			this.once("upgrade", t), this.once("upgradeError", t);
		};
		return (this.readyState === "opening" || this.readyState === "open") && (this.readyState = "closing", this.writeBuffer.length ? this.once("drain", () => {
			this.upgrading ? n() : e();
		}) : this.upgrading ? n() : e()), this;
	}
	_onError(t) {
		if (e.priorWebsocketSuccess = !1, this.opts.tryAllTransports && this.transports.length > 1 && this.readyState === "opening") return this.transports.shift(), this._open();
		this.emitReserved("error", t), this._onClose("transport error", t);
	}
	_onClose(e, t) {
		if (this.readyState === "opening" || this.readyState === "open" || this.readyState === "closing") {
			if (this.clearTimeoutFn(this._pingTimeoutTimer), this.transport.removeAllListeners("close"), this.transport.close(), this.transport.removeAllListeners(), Et && (this._beforeunloadEventListener && removeEventListener("beforeunload", this._beforeunloadEventListener, !1), this._offlineEventListener)) {
				let e = Dt.indexOf(this._offlineEventListener);
				e !== -1 && Dt.splice(e, 1);
			}
			this.readyState = "closed", this.id = null, this.emitReserved("close", e, t), this.writeBuffer = [], this._prevBufferLen = 0;
		}
	}
};
Ot.protocol = 4;
var kt = class extends Ot {
	constructor() {
		super(...arguments), this._upgrades = [];
	}
	onOpen() {
		if (super.onOpen(), this.readyState === "open" && this.opts.upgrade) for (let e = 0; e < this._upgrades.length; e++) this._probe(this._upgrades[e]);
	}
	_probe(e) {
		let t = this.createTransport(e), n = !1;
		Ot.priorWebsocketSuccess = !1;
		let r = () => {
			n || (t.send([{
				type: "ping",
				data: "probe"
			}]), t.once("packet", (e) => {
				if (!n) if (e.type === "pong" && e.data === "probe") {
					if (this.upgrading = !0, this.emitReserved("upgrading", t), !t) return;
					Ot.priorWebsocketSuccess = t.name === "websocket", this.transport.pause(() => {
						n || this.readyState !== "closed" && (l(), this.setTransport(t), t.send([{ type: "upgrade" }]), this.emitReserved("upgrade", t), t = null, this.upgrading = !1, this.flush());
					});
				} else {
					let e = /* @__PURE__ */ Error("probe error");
					e.transport = t.name, this.emitReserved("upgradeError", e);
				}
			}));
		};
		function i() {
			n || (n = !0, l(), t.close(), t = null);
		}
		let a = (e) => {
			let n = /* @__PURE__ */ Error("probe error: " + e);
			n.transport = t.name, i(), this.emitReserved("upgradeError", n);
		};
		function o() {
			a("transport closed");
		}
		function s() {
			a("socket closed");
		}
		function c(e) {
			t && e.name !== t.name && i();
		}
		let l = () => {
			t.removeListener("open", r), t.removeListener("error", a), t.removeListener("close", o), this.off("close", s), this.off("upgrading", c);
		};
		t.once("open", r), t.once("error", a), t.once("close", o), this.once("close", s), this.once("upgrading", c), this._upgrades.indexOf("webtransport") !== -1 && e !== "webtransport" ? this.setTimeoutFn(() => {
			n || t.open();
		}, 200) : t.open();
	}
	onHandshake(e) {
		this._upgrades = this._filterUpgrades(e.upgrades), super.onHandshake(e);
	}
	_filterUpgrades(e) {
		let t = [];
		for (let n = 0; n < e.length; n++) ~this.transports.indexOf(e[n]) && t.push(e[n]);
		return t;
	}
}, At = class extends kt {
	constructor(e, t = {}) {
		let n = typeof e == "object", r = n ? { ...e } : { ...t };
		(!r.transports || r.transports && typeof r.transports[0] == "string") && (r.transports = (r.transports || [
			"polling",
			"websocket",
			"webtransport"
		]).map((e) => bt[e]).filter((e) => !!e)), super(n ? r : e, r);
	}
};
At.protocol;
//#endregion
//#region node_modules/socket.io-client/build/esm/url.js
function jt(e, t = "", n) {
	let r = e;
	n ||= typeof location < "u" && location, e ??= n.protocol + "//" + n.host, typeof e == "string" && (e.charAt(0) === "/" && (e = e.charAt(1) === "/" ? n.protocol + e : n.host + e), /^(https?|wss?):\/\//.test(e) || (e = n === void 0 ? "https://" + e : n.protocol + "//" + e), r = Ct(e)), r.port || (/^(http|ws)$/.test(r.protocol) ? r.port = "80" : /^(http|ws)s$/.test(r.protocol) && (r.port = "443")), r.path = r.path || "/";
	let i = r.host.indexOf(":") === -1 ? r.host : "[" + r.host + "]";
	return r.id = r.protocol + "://" + i + ":" + r.port + t, r.href = r.protocol + "://" + i + (n && n.port === r.port ? "" : ":" + r.port), r;
}
//#endregion
//#region node_modules/socket.io-parser/build/esm/is-binary.js
var Mt = typeof ArrayBuffer == "function", Nt = (e) => typeof ArrayBuffer.isView == "function" ? ArrayBuffer.isView(e) : e.buffer instanceof ArrayBuffer, Pt = Object.prototype.toString, Ft = typeof Blob == "function" || typeof Blob < "u" && Pt.call(Blob) === "[object BlobConstructor]", It = typeof File == "function" || typeof File < "u" && Pt.call(File) === "[object FileConstructor]";
function Lt(e) {
	return Mt && (e instanceof ArrayBuffer || Nt(e)) || Ft && e instanceof Blob || It && e instanceof File;
}
function T(e, t) {
	if (!e || typeof e != "object") return !1;
	if (Array.isArray(e)) {
		for (let t = 0, n = e.length; t < n; t++) if (T(e[t])) return !0;
		return !1;
	}
	if (Lt(e)) return !0;
	if (e.toJSON && typeof e.toJSON == "function" && arguments.length === 1) return T(e.toJSON(), !0);
	for (let t in e) if (Object.prototype.hasOwnProperty.call(e, t) && T(e[t])) return !0;
	return !1;
}
//#endregion
//#region node_modules/socket.io-parser/build/esm/binary.js
function Rt(e) {
	let t = [], n = e.data, r = e;
	return r.data = E(n, t), r.attachments = t.length, {
		packet: r,
		buffers: t
	};
}
function E(e, t, n) {
	if (!e) return e;
	if (Lt(e)) {
		let n = {
			_placeholder: !0,
			num: t.length
		};
		return t.push(e), n;
	} else if (Array.isArray(e)) {
		let n = Array(e.length);
		for (let r = 0; r < e.length; r++) n[r] = E(e[r], t);
		return n;
	} else if (typeof e == "object" && !(e instanceof Date)) {
		if (e.toJSON && typeof e.toJSON == "function" && !n) return E(e.toJSON(), t, !0);
		let r = {};
		for (let n in e) Object.prototype.hasOwnProperty.call(e, n) && (r[n] = E(e[n], t));
		return r;
	}
	return e;
}
function zt(e, t) {
	return e.data = Bt(e.data, t), delete e.attachments, e;
}
function Bt(e, t) {
	if (!e) return e;
	if (e && e._placeholder === !0) {
		if (typeof e.num == "number" && e.num >= 0 && e.num < t.length) return t[e.num];
		throw Error("illegal attachments");
	} else if (Array.isArray(e)) for (let n = 0; n < e.length; n++) e[n] = Bt(e[n], t);
	else if (typeof e == "object") for (let n in e) Object.prototype.hasOwnProperty.call(e, n) && (e[n] = Bt(e[n], t));
	return e;
}
//#endregion
//#region node_modules/socket.io-parser/build/esm/index.js
var Vt = /* @__PURE__ */ t({
	Decoder: () => Wt,
	Encoder: () => Ut,
	PacketType: () => D,
	isPacketValid: () => Xt,
	protocol: () => 5
}), Ht = [
	"connect",
	"connect_error",
	"disconnect",
	"disconnecting",
	"newListener",
	"removeListener"
], D;
(function(e) {
	e[e.CONNECT = 0] = "CONNECT", e[e.DISCONNECT = 1] = "DISCONNECT", e[e.EVENT = 2] = "EVENT", e[e.ACK = 3] = "ACK", e[e.CONNECT_ERROR = 4] = "CONNECT_ERROR", e[e.BINARY_EVENT = 5] = "BINARY_EVENT", e[e.BINARY_ACK = 6] = "BINARY_ACK";
})(D ||= {});
var Ut = class {
	constructor(e) {
		this.replacer = e;
	}
	encode(e) {
		return (e.type === D.EVENT || e.type === D.ACK) && T(e) ? this.encodeAsBinary({
			type: e.type === D.EVENT ? D.BINARY_EVENT : D.BINARY_ACK,
			nsp: e.nsp,
			data: e.data,
			id: e.id
		}) : [this.encodeAsString(e)];
	}
	encodeAsString(e) {
		let t = "" + e.type;
		return (e.type === D.BINARY_EVENT || e.type === D.BINARY_ACK) && (t += e.attachments + "-"), e.nsp && e.nsp !== "/" && (t += e.nsp + ","), e.id != null && (t += e.id), e.data != null && (t += JSON.stringify(e.data, this.replacer)), t;
	}
	encodeAsBinary(e) {
		let t = Rt(e), n = this.encodeAsString(t.packet), r = t.buffers;
		return r.unshift(n), r;
	}
}, Wt = class e extends b {
	constructor(e) {
		super(), this.opts = Object.assign({
			reviver: void 0,
			maxAttachments: 10
		}, typeof e == "function" ? { reviver: e } : e);
	}
	add(e) {
		let t;
		if (typeof e == "string") {
			if (this.reconstructor) throw Error("got plaintext data when reconstructing a packet");
			t = this.decodeString(e);
			let n = t.type === D.BINARY_EVENT;
			n || t.type === D.BINARY_ACK ? (t.type = n ? D.EVENT : D.ACK, this.reconstructor = new Gt(t)) : super.emitReserved("decoded", t);
		} else if (Lt(e) || e.base64) if (this.reconstructor) t = this.reconstructor.takeBinaryData(e), t && (this.reconstructor = null, super.emitReserved("decoded", t));
		else throw Error("got binary data when not reconstructing a packet");
		else throw Error("Unknown type: " + e);
	}
	decodeString(t) {
		let n = 0, r = { type: Number(t.charAt(0)) };
		if (D[r.type] === void 0) throw Error("unknown packet type " + r.type);
		if (r.type === D.BINARY_EVENT || r.type === D.BINARY_ACK) {
			let e = n + 1;
			for (; t.charAt(++n) !== "-" && n != t.length;);
			let i = t.substring(e, n);
			if (i != Number(i) || t.charAt(n) !== "-") throw Error("Illegal attachments");
			let a = Number(i);
			if (!qt(a) || a < 1) throw Error("Illegal attachments");
			if (a > this.opts.maxAttachments) throw Error("too many attachments");
			r.attachments = a;
		}
		if (t.charAt(n + 1) === "/") {
			let e = n + 1;
			for (; ++n && !(t.charAt(n) === "," || n === t.length););
			r.nsp = t.substring(e, n);
		} else r.nsp = "/";
		let i = t.charAt(n + 1);
		if (i !== "" && Number(i) == i) {
			let e = n + 1;
			for (; ++n;) {
				let e = t.charAt(n);
				if (e == null || Number(e) != e) {
					--n;
					break;
				}
				if (n === t.length) break;
			}
			r.id = Number(t.substring(e, n + 1));
		}
		if (t.charAt(++n)) {
			let i = this.tryParse(t.substr(n));
			if (e.isPayloadValid(r.type, i)) r.data = i;
			else throw Error("invalid payload");
		}
		return r;
	}
	tryParse(e) {
		try {
			return JSON.parse(e, this.opts.reviver);
		} catch {
			return !1;
		}
	}
	static isPayloadValid(e, t) {
		switch (e) {
			case D.CONNECT: return O(t);
			case D.DISCONNECT: return t === void 0;
			case D.CONNECT_ERROR: return typeof t == "string" || O(t);
			case D.EVENT:
			case D.BINARY_EVENT: return Array.isArray(t) && (typeof t[0] == "number" || typeof t[0] == "string" && Ht.indexOf(t[0]) === -1);
			case D.ACK:
			case D.BINARY_ACK: return Array.isArray(t);
		}
	}
	destroy() {
		this.reconstructor &&= (this.reconstructor.finishedReconstruction(), null);
	}
}, Gt = class {
	constructor(e) {
		this.packet = e, this.buffers = [], this.reconPack = e;
	}
	takeBinaryData(e) {
		if (this.buffers.push(e), this.buffers.length === this.reconPack.attachments) {
			let e = zt(this.reconPack, this.buffers);
			return this.finishedReconstruction(), e;
		}
		return null;
	}
	finishedReconstruction() {
		this.reconPack = null, this.buffers = [];
	}
};
function Kt(e) {
	return typeof e == "string";
}
var qt = Number.isInteger || function(e) {
	return typeof e == "number" && isFinite(e) && Math.floor(e) === e;
};
function Jt(e) {
	return e === void 0 || qt(e);
}
function O(e) {
	return Object.prototype.toString.call(e) === "[object Object]";
}
function Yt(e, t) {
	switch (e) {
		case D.CONNECT: return t === void 0 || O(t);
		case D.DISCONNECT: return t === void 0;
		case D.EVENT: return Array.isArray(t) && (typeof t[0] == "number" || typeof t[0] == "string" && Ht.indexOf(t[0]) === -1);
		case D.ACK: return Array.isArray(t);
		case D.CONNECT_ERROR: return typeof t == "string" || O(t);
		default: return !1;
	}
}
function Xt(e) {
	return Kt(e.nsp) && Jt(e.id) && Yt(e.type, e.data);
}
//#endregion
//#region node_modules/socket.io-client/build/esm/on.js
function k(e, t, n) {
	return e.on(t, n), function() {
		e.off(t, n);
	};
}
//#endregion
//#region node_modules/socket.io-client/build/esm/socket.js
var Zt = Object.freeze({
	connect: 1,
	connect_error: 1,
	disconnect: 1,
	disconnecting: 1,
	newListener: 1,
	removeListener: 1
}), Qt = class extends b {
	constructor(e, t, n) {
		super(), this.connected = !1, this.recovered = !1, this.receiveBuffer = [], this.sendBuffer = [], this._queue = [], this._queueSeq = 0, this.ids = 0, this.acks = {}, this.flags = {}, this.io = e, this.nsp = t, n && n.auth && (this.auth = n.auth), this._opts = Object.assign({}, n), this.io._autoConnect && this.open();
	}
	get disconnected() {
		return !this.connected;
	}
	subEvents() {
		if (this.subs) return;
		let e = this.io;
		this.subs = [
			k(e, "open", this.onopen.bind(this)),
			k(e, "packet", this.onpacket.bind(this)),
			k(e, "error", this.onerror.bind(this)),
			k(e, "close", this.onclose.bind(this))
		];
	}
	get active() {
		return !!this.subs;
	}
	connect() {
		return this.connected ? this : (this.subEvents(), this.io._reconnecting || this.io.open(), this.io._readyState === "open" && this.onopen(), this);
	}
	open() {
		return this.connect();
	}
	send(...e) {
		return e.unshift("message"), this.emit.apply(this, e), this;
	}
	emit(e, ...t) {
		if (Zt.hasOwnProperty(e)) throw Error("\"" + e.toString() + "\" is a reserved event name");
		if (t.unshift(e), this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) return this._addToQueue(t), this;
		let n = {
			type: D.EVENT,
			data: t
		};
		if (n.options = {}, n.options.compress = this.flags.compress !== !1, typeof t[t.length - 1] == "function") {
			let e = this.ids++, r = t.pop();
			this._registerAckCallback(e, r), n.id = e;
		}
		let r = this.io.engine?.transport?.writable, i = this.connected && !this.io.engine?._hasPingExpired();
		return this.flags.volatile && !r || (i ? (this.notifyOutgoingListeners(n), this.packet(n)) : this.sendBuffer.push(n)), this.flags = {}, this;
	}
	_registerAckCallback(e, t) {
		let n = this.flags.timeout ?? this._opts.ackTimeout;
		if (n === void 0) {
			this.acks[e] = t;
			return;
		}
		let r = this.io.setTimeoutFn(() => {
			delete this.acks[e];
			for (let t = 0; t < this.sendBuffer.length; t++) this.sendBuffer[t].id === e && this.sendBuffer.splice(t, 1);
			t.call(this, /* @__PURE__ */ Error("operation has timed out"));
		}, n), i = (...e) => {
			this.io.clearTimeoutFn(r), t.apply(this, e);
		};
		i.withError = !0, this.acks[e] = i;
	}
	emitWithAck(e, ...t) {
		return new Promise((n, r) => {
			let i = (e, t) => e ? r(e) : n(t);
			i.withError = !0, t.push(i), this.emit(e, ...t);
		});
	}
	_addToQueue(e) {
		let t;
		typeof e[e.length - 1] == "function" && (t = e.pop());
		let n = {
			id: this._queueSeq++,
			tryCount: 0,
			pending: !1,
			args: e,
			flags: Object.assign({ fromQueue: !0 }, this.flags)
		};
		e.push((e, ...r) => (this._queue[0], e === null ? (this._queue.shift(), t && t(null, ...r)) : n.tryCount > this._opts.retries && (this._queue.shift(), t && t(e)), n.pending = !1, this._drainQueue())), this._queue.push(n), this._drainQueue();
	}
	_drainQueue(e = !1) {
		if (!this.connected || this._queue.length === 0) return;
		let t = this._queue[0];
		t.pending && !e || (t.pending = !0, t.tryCount++, this.flags = t.flags, this.emit.apply(this, t.args));
	}
	packet(e) {
		e.nsp = this.nsp, this.io._packet(e);
	}
	onopen() {
		typeof this.auth == "function" ? this.auth((e) => {
			this._sendConnectPacket(e);
		}) : this._sendConnectPacket(this.auth);
	}
	_sendConnectPacket(e) {
		this.packet({
			type: D.CONNECT,
			data: this._pid ? Object.assign({
				pid: this._pid,
				offset: this._lastOffset
			}, e) : e
		});
	}
	onerror(e) {
		this.connected || this.emitReserved("connect_error", e);
	}
	onclose(e, t) {
		this.connected = !1, delete this.id, this.emitReserved("disconnect", e, t), this._clearAcks();
	}
	_clearAcks() {
		Object.keys(this.acks).forEach((e) => {
			if (!this.sendBuffer.some((t) => String(t.id) === e)) {
				let t = this.acks[e];
				delete this.acks[e], t.withError && t.call(this, /* @__PURE__ */ Error("socket has been disconnected"));
			}
		});
	}
	onpacket(e) {
		if (e.nsp === this.nsp) switch (e.type) {
			case D.CONNECT:
				e.data && e.data.sid ? this.onconnect(e.data.sid, e.data.pid) : this.emitReserved("connect_error", /* @__PURE__ */ Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
				break;
			case D.EVENT:
			case D.BINARY_EVENT:
				this.onevent(e);
				break;
			case D.ACK:
			case D.BINARY_ACK:
				this.onack(e);
				break;
			case D.DISCONNECT:
				this.ondisconnect();
				break;
			case D.CONNECT_ERROR:
				this.destroy();
				let t = Error(e.data.message);
				t.data = e.data.data, this.emitReserved("connect_error", t);
				break;
		}
	}
	onevent(e) {
		let t = e.data || [];
		e.id != null && t.push(this.ack(e.id)), this.connected ? this.emitEvent(t) : this.receiveBuffer.push(Object.freeze(t));
	}
	emitEvent(e) {
		if (this._anyListeners && this._anyListeners.length) {
			let t = this._anyListeners.slice();
			for (let n of t) n.apply(this, e);
		}
		super.emit.apply(this, e), this._pid && e.length && typeof e[e.length - 1] == "string" && (this._lastOffset = e[e.length - 1]);
	}
	ack(e) {
		let t = this, n = !1;
		return function(...r) {
			n || (n = !0, t.packet({
				type: D.ACK,
				id: e,
				data: r
			}));
		};
	}
	onack(e) {
		let t = this.acks[e.id];
		typeof t == "function" && (delete this.acks[e.id], t.withError && e.data.unshift(null), t.apply(this, e.data));
	}
	onconnect(e, t) {
		this.id = e, this.recovered = t && this._pid === t, this._pid = t, this.connected = !0, this.emitBuffered(), this._drainQueue(!0), this.emitReserved("connect");
	}
	emitBuffered() {
		this.receiveBuffer.forEach((e) => this.emitEvent(e)), this.receiveBuffer = [], this.sendBuffer.forEach((e) => {
			this.notifyOutgoingListeners(e), this.packet(e);
		}), this.sendBuffer = [];
	}
	ondisconnect() {
		this.destroy(), this.onclose("io server disconnect");
	}
	destroy() {
		this.subs &&= (this.subs.forEach((e) => e()), void 0), this.io._destroy(this);
	}
	disconnect() {
		return this.connected && this.packet({ type: D.DISCONNECT }), this.destroy(), this.connected && this.onclose("io client disconnect"), this;
	}
	close() {
		return this.disconnect();
	}
	compress(e) {
		return this.flags.compress = e, this;
	}
	get volatile() {
		return this.flags.volatile = !0, this;
	}
	timeout(e) {
		return this.flags.timeout = e, this;
	}
	onAny(e) {
		return this._anyListeners = this._anyListeners || [], this._anyListeners.push(e), this;
	}
	prependAny(e) {
		return this._anyListeners = this._anyListeners || [], this._anyListeners.unshift(e), this;
	}
	offAny(e) {
		if (!this._anyListeners) return this;
		if (e) {
			let t = this._anyListeners;
			for (let n = 0; n < t.length; n++) if (e === t[n]) return t.splice(n, 1), this;
		} else this._anyListeners = [];
		return this;
	}
	listenersAny() {
		return this._anyListeners || [];
	}
	onAnyOutgoing(e) {
		return this._anyOutgoingListeners = this._anyOutgoingListeners || [], this._anyOutgoingListeners.push(e), this;
	}
	prependAnyOutgoing(e) {
		return this._anyOutgoingListeners = this._anyOutgoingListeners || [], this._anyOutgoingListeners.unshift(e), this;
	}
	offAnyOutgoing(e) {
		if (!this._anyOutgoingListeners) return this;
		if (e) {
			let t = this._anyOutgoingListeners;
			for (let n = 0; n < t.length; n++) if (e === t[n]) return t.splice(n, 1), this;
		} else this._anyOutgoingListeners = [];
		return this;
	}
	listenersAnyOutgoing() {
		return this._anyOutgoingListeners || [];
	}
	notifyOutgoingListeners(e) {
		if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
			let t = this._anyOutgoingListeners.slice();
			for (let n of t) n.apply(this, e.data);
		}
	}
};
//#endregion
//#region node_modules/socket.io-client/build/esm/contrib/backo2.js
function A(e) {
	e ||= {}, this.ms = e.min || 100, this.max = e.max || 1e4, this.factor = e.factor || 2, this.jitter = e.jitter > 0 && e.jitter <= 1 ? e.jitter : 0, this.attempts = 0;
}
A.prototype.duration = function() {
	var e = this.ms * this.factor ** +this.attempts++;
	if (this.jitter) {
		var t = Math.random(), n = Math.floor(t * this.jitter * e);
		e = Math.floor(t * 10) & 1 ? e + n : e - n;
	}
	return Math.min(e, this.max) | 0;
}, A.prototype.reset = function() {
	this.attempts = 0;
}, A.prototype.setMin = function(e) {
	this.ms = e;
}, A.prototype.setMax = function(e) {
	this.max = e;
}, A.prototype.setJitter = function(e) {
	this.jitter = e;
};
//#endregion
//#region node_modules/socket.io-client/build/esm/manager.js
var $t = class extends b {
	constructor(e, t) {
		super(), this.nsps = {}, this.subs = [], e && typeof e == "object" && (t = e, e = void 0), t ||= {}, t.path = t.path || "/socket.io", this.opts = t, C(this, t), this.reconnection(t.reconnection !== !1), this.reconnectionAttempts(t.reconnectionAttempts || Infinity), this.reconnectionDelay(t.reconnectionDelay || 1e3), this.reconnectionDelayMax(t.reconnectionDelayMax || 5e3), this.randomizationFactor(t.randomizationFactor ?? .5), this.backoff = new A({
			min: this.reconnectionDelay(),
			max: this.reconnectionDelayMax(),
			jitter: this.randomizationFactor()
		}), this.timeout(t.timeout == null ? 2e4 : t.timeout), this._readyState = "closed", this.uri = e;
		let n = t.parser || Vt;
		this.encoder = new n.Encoder(), this.decoder = new n.Decoder(), this._autoConnect = t.autoConnect !== !1, this._autoConnect && this.open();
	}
	reconnection(e) {
		return arguments.length ? (this._reconnection = !!e, e || (this.skipReconnect = !0), this) : this._reconnection;
	}
	reconnectionAttempts(e) {
		return e === void 0 ? this._reconnectionAttempts : (this._reconnectionAttempts = e, this);
	}
	reconnectionDelay(e) {
		var t;
		return e === void 0 ? this._reconnectionDelay : (this._reconnectionDelay = e, (t = this.backoff) == null || t.setMin(e), this);
	}
	randomizationFactor(e) {
		var t;
		return e === void 0 ? this._randomizationFactor : (this._randomizationFactor = e, (t = this.backoff) == null || t.setJitter(e), this);
	}
	reconnectionDelayMax(e) {
		var t;
		return e === void 0 ? this._reconnectionDelayMax : (this._reconnectionDelayMax = e, (t = this.backoff) == null || t.setMax(e), this);
	}
	timeout(e) {
		return arguments.length ? (this._timeout = e, this) : this._timeout;
	}
	maybeReconnectOnOpen() {
		!this._reconnecting && this._reconnection && this.backoff.attempts === 0 && this.reconnect();
	}
	open(e) {
		if (~this._readyState.indexOf("open")) return this;
		this.engine = new At(this.uri, this.opts);
		let t = this.engine, n = this;
		this._readyState = "opening", this.skipReconnect = !1;
		let r = k(t, "open", function() {
			n.onopen(), e && e();
		}), i = (t) => {
			this.cleanup(), this._readyState = "closed", this.emitReserved("error", t), e ? e(t) : this.maybeReconnectOnOpen();
		}, a = k(t, "error", i);
		if (!1 !== this._timeout) {
			let e = this._timeout, n = this.setTimeoutFn(() => {
				r(), i(/* @__PURE__ */ Error("timeout")), t.close();
			}, e);
			this.opts.autoUnref && n.unref(), this.subs.push(() => {
				this.clearTimeoutFn(n);
			});
		}
		return this.subs.push(r), this.subs.push(a), this;
	}
	connect(e) {
		return this.open(e);
	}
	onopen() {
		this.cleanup(), this._readyState = "open", this.emitReserved("open");
		let e = this.engine;
		this.subs.push(k(e, "ping", this.onping.bind(this)), k(e, "data", this.ondata.bind(this)), k(e, "error", this.onerror.bind(this)), k(e, "close", this.onclose.bind(this)), k(this.decoder, "decoded", this.ondecoded.bind(this)));
	}
	onping() {
		this.emitReserved("ping");
	}
	ondata(e) {
		try {
			this.decoder.add(e);
		} catch (e) {
			this.onclose("parse error", e);
		}
	}
	ondecoded(e) {
		x(() => {
			this.emitReserved("packet", e);
		}, this.setTimeoutFn);
	}
	onerror(e) {
		this.emitReserved("error", e);
	}
	socket(e, t) {
		let n = this.nsps[e];
		return n ? this._autoConnect && !n.active && n.connect() : (n = new Qt(this, e, t), this.nsps[e] = n), n;
	}
	_destroy(e) {
		let t = Object.keys(this.nsps);
		for (let e of t) if (this.nsps[e].active) return;
		this._close();
	}
	_packet(e) {
		let t = this.encoder.encode(e);
		for (let n = 0; n < t.length; n++) this.engine.write(t[n], e.options);
	}
	cleanup() {
		this.subs.forEach((e) => e()), this.subs.length = 0, this.decoder.destroy();
	}
	_close() {
		this.skipReconnect = !0, this._reconnecting = !1, this.onclose("forced close");
	}
	disconnect() {
		return this._close();
	}
	onclose(e, t) {
		var n;
		this.cleanup(), (n = this.engine) == null || n.close(), this.backoff.reset(), this._readyState = "closed", this.emitReserved("close", e, t), this._reconnection && !this.skipReconnect && this.reconnect();
	}
	reconnect() {
		if (this._reconnecting || this.skipReconnect) return this;
		let e = this;
		if (this.backoff.attempts >= this._reconnectionAttempts) this.backoff.reset(), this.emitReserved("reconnect_failed"), this._reconnecting = !1;
		else {
			let t = this.backoff.duration();
			this._reconnecting = !0;
			let n = this.setTimeoutFn(() => {
				e.skipReconnect || (this.emitReserved("reconnect_attempt", e.backoff.attempts), !e.skipReconnect && e.open((t) => {
					t ? (e._reconnecting = !1, e.reconnect(), this.emitReserved("reconnect_error", t)) : e.onreconnect();
				}));
			}, t);
			this.opts.autoUnref && n.unref(), this.subs.push(() => {
				this.clearTimeoutFn(n);
			});
		}
	}
	onreconnect() {
		let e = this.backoff.attempts;
		this._reconnecting = !1, this.backoff.reset(), this.emitReserved("reconnect", e);
	}
}, j = {};
function M(e, t) {
	typeof e == "object" && (t = e, e = void 0), t ||= {};
	let n = jt(e, t.path || "/socket.io"), r = n.source, i = n.id, a = n.path, o = j[i] && a in j[i].nsps, s = t.forceNew || t["force new connection"] || !1 === t.multiplex || o, c;
	return s ? c = new $t(r, t) : (j[i] || (j[i] = new $t(r, t)), c = j[i]), n.query && !t.query && (t.query = n.queryKey), c.socket(n.path, t);
}
Object.assign(M, {
	Manager: $t,
	Socket: Qt,
	io: M,
	connect: M
});
var N = new class {
	socket = null;
	status = "disconnected";
	getStatus() {
		return this.status;
	}
	start() {
		if (this.socket) return;
		let e = d();
		e && (this.setStatus("connecting"), this.socket = M(`${e}/ws`, {
			transports: ["websocket"],
			auth: (e) => {
				h.ensureAccessToken().then((t) => e({ token: t })).catch(() => e({ token: "" }));
			}
		}), this.socket.on("connect", () => this.setStatus("connected")), this.socket.on("disconnect", () => this.setStatus("degraded")), this.socket.on("connect_error", (e) => {
			this.setStatus("degraded"), p.warn("Atlas Foundry: socket connect_error", e);
		}), this.socket.onAny((e, t) => {
			Hooks.callAll("atlas-foundry.socketEvent", e, t);
		}));
	}
	stop() {
		this.socket?.disconnect(), this.socket = null, this.setStatus("disconnected");
	}
	restart() {
		this.stop(), this.start();
	}
	setStatus(e) {
		this.status !== e && (this.status = e, Hooks.callAll("atlas-foundry.socketStatusChanged", e));
	}
}();
//#endregion
//#region src/auth/status.ts
function en() {
	let e = h.getState();
	if (e === "revoked") return {
		color: "red",
		messageKey: h.getRevokedReason() === "world-mismatch" ? "ATLASFOUNDRY.Status.WorldMismatch" : "ATLASFOUNDRY.Status.Revoked"
	};
	if (e === "loggedOut") return {
		color: "grey",
		messageKey: "ATLASFOUNDRY.Status.LoggedOut"
	};
	if (e === "linking") return {
		color: "grey",
		messageKey: "ATLASFOUNDRY.Status.Linking"
	};
	if (N.getStatus() === "connected") {
		let e = h.getMe();
		return {
			color: "green",
			messageKey: "ATLASFOUNDRY.Status.Connected",
			messageData: {
				displayName: e?.displayName ?? "",
				campaignName: e?.campaignName ?? ""
			}
		};
	}
	return {
		color: "yellow",
		messageKey: "ATLASFOUNDRY.Status.Reconnecting"
	};
}
//#endregion
//#region src/apps/settings-app.ts
function P(e) {
	let t = en(), n = e.querySelector("[data-status-dot]"), r = e.querySelector("[data-status-text]"), i = e.querySelector("[data-action=\"auth-toggle\"]");
	n && (n.className = `atlas-foundry-dot atlas-foundry-dot-${t.color}`), r && (r.textContent = o(t.messageKey, t.messageData)), i && (i.textContent = o(h.isLinked() ? "ATLASFOUNDRY.Settings.Logout" : "ATLASFOUNDRY.Settings.Login"));
}
async function tn() {
	if (!game.user.isGM) {
		ui.notifications.warn(o("ATLASFOUNDRY.Settings.GmOnly"));
		return;
	}
	let e = `
    <form class="atlas-foundry-settings">
      <div class="form-group atlas-foundry-status-row">
        <span class="atlas-foundry-dot" data-status-dot></span>
        <span data-status-text></span>
        <button type="button" data-action="auth-toggle"></button>
      </div>
      <div class="form-group">
        <label>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Settings.BaseUrl.Name"))}</label>
        <input name="baseUrl" type="url" value="${foundry.utils.escapeHTML(d())}" placeholder="https://atlas.example.com">
        <p class="hint">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Settings.BaseUrl.Hint"))}</p>
      </div>
      <div class="form-group">
        <label>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Settings.CampaignId.Name"))}</label>
        <input name="campaignId" type="text" value="${foundry.utils.escapeHTML(f())}">
        <p class="hint">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Settings.CampaignId.Hint"))}</p>
      </div>
      <div class="form-group">
        <button type="button" data-action="test-connection">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Settings.TestConnection"))}</button>
        <p class="atlas-foundry-status" data-test-status></p>
      </div>
    </form>
  `, t, n;
	try {
		await foundry.applications.api.DialogV2.prompt({
			window: { title: "ATLASFOUNDRY.Settings.Title" },
			content: e,
			render: (e, r) => {
				P(r.element), t = () => P(r.element), n = () => P(r.element), Hooks.on("atlas-foundry.authChanged", t), Hooks.on("atlas-foundry.socketStatusChanged", n), r.element.querySelector("[data-action=\"auth-toggle\"]")?.addEventListener("click", async () => {
					h.isLinked() ? await h.logout() : await g(), P(r.element);
				});
				let i = r.element.querySelector("[data-action=\"test-connection\"]"), a = r.element.querySelector("[data-test-status]"), s = r.element.querySelector("input[name=\"baseUrl\"]");
				i?.addEventListener("click", async () => {
					if (a) {
						a.classList.remove("atlas-foundry-status-ok", "atlas-foundry-status-error"), a.textContent = o("ATLASFOUNDRY.Settings.TestingConnection");
						try {
							let e = await he(s?.value ?? "");
							a.textContent = ge(e), a.classList.add(e.ok ? "atlas-foundry-status-ok" : "atlas-foundry-status-error");
						} catch (e) {
							m(e, "ATLASFOUNDRY.ConnectionTest.UnexpectedError"), a.textContent = o("ATLASFOUNDRY.ConnectionTest.UnexpectedError"), a.classList.add("atlas-foundry-status-error");
						}
					}
				});
			},
			ok: {
				label: "ATLASFOUNDRY.Settings.Save",
				callback: async (e, t) => {
					let n = t.form.elements.namedItem("baseUrl"), r = t.form.elements.namedItem("campaignId"), { normalized: i, warningKey: a } = l(n?.value ?? "");
					await ee(i), await te(r?.value.trim() ?? ""), a && ui.notifications.warn(o(a));
				}
			}
		});
	} finally {
		t && Hooks.off("atlas-foundry.authChanged", t), n && Hooks.off("atlas-foundry.socketStatusChanged", n);
	}
}
//#endregion
//#region src/deep-links.ts
function nn() {
	return game.i18n.lang?.toLowerCase().startsWith("de") ? "de" : "en";
}
function F(e, t, n, r) {
	return `${d()}/${nn()}/campaigns/${e}/${t === "custom" ? `custom/${r}` : t}/${n}`;
}
function rn(e) {
	return `${d()}/${nn()}/campaigns/${e}`;
}
//#endregion
//#region src/api/errors.ts
var I = class extends Error {
	path;
	constructor(e, t) {
		super(e), this.name = "AtlasApiError", this.path = t;
	}
}, L = class extends I {
	constructor(e, t = "Unauthorized") {
		super(t, e), this.name = "AtlasAuthError";
	}
}, R = class extends I {
	constructor(e, t = "Forbidden") {
		super(t, e), this.name = "AtlasForbiddenError";
	}
}, z = class extends I {
	constructor(e, t = "Not found") {
		super(t, e), this.name = "AtlasNotFoundError";
	}
}, an = class extends I {
	status;
	constructor(e, t, n = "Server error") {
		super(n, e), this.name = "AtlasServerError", this.status = t;
	}
}, B = class extends I {
	constructor(e, t = "Network error") {
		super(t, e), this.name = "AtlasNetworkError";
	}
};
function V(e) {
	return e instanceof L ? "ATLASFOUNDRY.ApiError.Auth" : e instanceof R ? "ATLASFOUNDRY.ApiError.Forbidden" : e instanceof z ? "ATLASFOUNDRY.ApiError.NotFound" : e instanceof an ? "ATLASFOUNDRY.ApiError.Server" : e instanceof B ? "ATLASFOUNDRY.ApiError.Network" : "ATLASFOUNDRY.ApiError.Unknown";
}
//#endregion
//#region src/api/client.ts
var on = 1e4, sn = /* @__PURE__ */ new Map();
async function cn(e) {
	try {
		return await e.json();
	} catch {
		return null;
	}
}
async function ln(e, t) {
	let n = (await cn(e))?.message;
	return e.status === 401 ? new L(t, n) : e.status === 403 ? new R(t, n) : e.status === 404 ? new z(t, n) : new an(t, e.status, n);
}
async function un(e, t, n = !1) {
	let r = d();
	if (!r) throw new B(e, "Atlas Foundry: base URL not configured");
	let i = t.timeoutMs ?? on, a = new AbortController(), o = () => a.abort(), s = setTimeout(() => a.abort(), i);
	t.signal?.addEventListener("abort", o);
	try {
		let i;
		try {
			i = await h.ensureAccessToken();
		} catch {
			throw new L(e, "Not logged in");
		}
		let o;
		try {
			o = await fetch(`${r}/api/v1${e}`, {
				method: t.method ?? "GET",
				headers: {
					Authorization: `Bearer ${i}`,
					...t.body === void 0 ? {} : { "Content-Type": "application/json" }
				},
				body: t.body === void 0 ? void 0 : JSON.stringify(t.body),
				signal: a.signal
			});
		} catch (t) {
			throw a.signal.aborted ? new B(e, "Request timed out") : new B(e, t instanceof Error ? t.message : String(t));
		}
		if (o.status === 401 && !n) return h.invalidateCache(), un(e, t, !0);
		if (!o.ok) throw await ln(o, e);
		return o.status === 204 ? void 0 : await o.json();
	} finally {
		clearTimeout(s), t.signal?.removeEventListener("abort", o);
	}
}
async function H(e, t = {}) {
	if ((t.method ?? "GET") !== "GET") return un(e, t);
	let n = sn.get(e);
	if (n) return n;
	let r = un(e, t).finally(() => sn.delete(e));
	return sn.set(e, r), r;
}
//#endregion
//#region src/api/cache.ts
var dn = class {
	store = /* @__PURE__ */ new Map();
	inFlight = /* @__PURE__ */ new Map();
	async getOrFetch(e, t, n) {
		let r = this.store.get(e);
		if (r && r.expiresAt > Date.now()) return r.value;
		let i = this.inFlight.get(e);
		if (i) return i;
		let a = n().then((n) => (this.store.set(e, {
			value: n,
			expiresAt: Date.now() + t
		}), n)).finally(() => this.inFlight.delete(e));
		return this.inFlight.set(e, a), a;
	}
	invalidate(e) {
		for (let t of this.store.keys()) t.startsWith(e) && this.store.delete(t);
		for (let t of this.inFlight.keys()) t.startsWith(e) && this.inFlight.delete(t);
	}
	delete(e) {
		this.store.delete(e);
	}
	clear() {
		this.store.clear(), this.inFlight.clear();
	}
}, U = "list:", fn = "doc:", W = new dn();
Hooks.on("atlas-foundry.socketEvent", (e, t) => {
	let n = t?.documentId;
	typeof n != "string" || !n || (W.invalidate(U), W.delete(`${fn}${n}`));
});
//#endregion
//#region src/api/documents.ts
var pn = 6e4;
function mn(e) {
	let t = h.getLinkedCampaignId();
	if (!t) throw new L(e, "Not logged in");
	return t;
}
async function hn(e, t, n = {}) {
	let r = `/foundry/campaigns/${mn(`/foundry/campaigns/*/user-documents/${e}/${t}`)}/user-documents/${e}/${t}`, i = `${fn}${t}`;
	try {
		return await W.getOrFetch(i, pn, () => H(r, { signal: n.signal }));
	} catch (e) {
		throw (e instanceof R || e instanceof z) && W.delete(i), e;
	}
}
async function gn(e, t) {
	return W.delete(`${fn}${t}`), hn(e, t);
}
//#endregion
//#region src/render/sanitize.ts
var _n = /* @__PURE__ */ new Set(/* @__PURE__ */ "p.h1.h2.h3.h4.ul.ol.li.blockquote.pre.code.strong.em.u.s.span.a.hr.br.table.thead.tbody.tr.th.td.img.svg.path.polyline.line.circle.rect.g".split(".")), vn = /* @__PURE__ */ new Set(["class"]), yn = {
	a: /* @__PURE__ */ new Set([
		"href",
		"target",
		"rel"
	]),
	img: /* @__PURE__ */ new Set([
		"src",
		"alt",
		"width",
		"height"
	]),
	span: /* @__PURE__ */ new Set(["style"]),
	td: /* @__PURE__ */ new Set(["colspan", "rowspan"]),
	th: /* @__PURE__ */ new Set(["colspan", "rowspan"]),
	svg: /* @__PURE__ */ new Set([
		"xmlns",
		"viewbox",
		"width",
		"height",
		"fill",
		"stroke",
		"stroke-width",
		"stroke-linecap",
		"stroke-linejoin"
	]),
	path: /* @__PURE__ */ new Set(["d"]),
	polyline: /* @__PURE__ */ new Set(["points"]),
	line: /* @__PURE__ */ new Set([
		"x1",
		"x2",
		"y1",
		"y2"
	]),
	circle: /* @__PURE__ */ new Set([
		"cx",
		"cy",
		"r"
	]),
	rect: /* @__PURE__ */ new Set([
		"width",
		"height",
		"x",
		"y",
		"rx",
		"ry"
	])
}, bn = /* @__PURE__ */ new Set(["href", "src"]), xn = /* @__PURE__ */ new Set(["color", "font-family"]);
function Sn(e) {
	return /^https?:\/\//i.test(e.trim());
}
function Cn(e) {
	return e.split(";").map((e) => e.trim()).filter(Boolean).filter((e) => {
		let t = e.indexOf(":");
		if (t < 0) return !1;
		let n = e.slice(0, t).trim().toLowerCase();
		return xn.has(n);
	}).join("; ");
}
function wn(e) {
	let t = yn[e.tagName.toLowerCase()];
	for (let n of Array.from(e.attributes)) {
		let r = n.name.toLowerCase();
		if (r.startsWith("on")) {
			e.removeAttribute(n.name);
			continue;
		}
		if (!r.startsWith("data-")) {
			if (r === "style") {
				let t = Cn(n.value);
				t ? e.setAttribute("style", t) : e.removeAttribute("style");
				continue;
			}
			if (bn.has(r)) {
				Sn(n.value) || e.removeAttribute(n.name);
				continue;
			}
			vn.has(r) || t?.has(r) || e.removeAttribute(n.name);
		}
	}
}
function Tn(e) {
	for (let t of Array.from(e.childNodes)) {
		if (t.nodeType === Node.TEXT_NODE) continue;
		if (t.nodeType !== Node.ELEMENT_NODE) {
			t.remove();
			continue;
		}
		let e = t;
		if (!_n.has(e.tagName.toLowerCase())) {
			e.remove();
			continue;
		}
		wn(e), Tn(e);
	}
}
function En(e) {
	let t = document.createElement("template");
	return t.innerHTML = e, Tn(t.content), t.innerHTML;
}
//#endregion
//#region src/render/entry-renderer.ts
function Dn(e, t) {
	e.querySelectorAll("[data-document-id][data-module-type]").forEach((e) => {
		let n = e.getAttribute("data-module-type"), r = e.getAttribute("data-document-id");
		r && (e.classList.add("atlas-mention"), e.setAttribute("role", "button"), e.setAttribute("tabindex", "0"), e.addEventListener("click", (e) => {
			e.preventDefault(), t(n, r, e.shiftKey);
		}), e.addEventListener("contextmenu", (e) => {
			e.preventDefault(), t(n, r, !0);
		}), e.addEventListener("keydown", (e) => {
			let i = e.key;
			(i === "Enter" || i === " ") && (e.preventDefault(), t(n, r, !1));
		}));
	});
}
function On(e) {
	e.querySelectorAll("img").forEach((e) => {
		e.setAttribute("loading", "lazy"), e.addEventListener("error", () => {
			let t = document.createElement("span");
			t.className = "atlas-foundry-image-fallback", t.textContent = o("ATLASFOUNDRY.Entry.ImageUnavailable"), e.replaceWith(t);
		}, { once: !0 });
	});
}
async function kn(e, t) {
	let n = En(e), r = n;
	try {
		r = await foundry.applications.ux.TextEditor.implementation.enrichHTML(n, { async: !0 });
	} catch (e) {
		p.warn("Atlas Foundry: enrichHTML failed, showing sanitized entry as-is", e);
	}
	let i = document.createElement("div");
	return i.className = "atlas-foundry-entry", i.innerHTML = r, Dn(i, t.onMentionActivate), On(i), i;
}
//#endregion
//#region src/apps/viewer-app.ts
var An = "fa-solid fa-puzzle-piece", jn = /* @__PURE__ */ new Map();
function G(e) {
	let t = jn.get(e.documentId);
	if (t) {
		t.bringToFront();
		return;
	}
	new Mn(e).render(!0);
}
var Mn = class extends foundry.applications.api.ApplicationV2 {
	static DEFAULT_OPTIONS = {
		classes: ["atlas-foundry-viewer"],
		window: {
			title: "ATLASFOUNDRY.Viewer.Title",
			icon: "fa-solid fa-scroll",
			resizable: !0
		},
		position: {
			width: 700,
			height: 680
		}
	};
	moduleType;
	documentId;
	state = "loading";
	doc = null;
	errorKey = null;
	notFoundOrForbidden = !1;
	constructor(e) {
		super({
			id: `atlas-viewer-${e.documentId}`,
			window: { title: e.name ?? "ATLASFOUNDRY.Viewer.Title" }
		}), this.moduleType = e.moduleType, this.documentId = e.documentId, jn.set(e.documentId, this), this.load();
	}
	async load() {
		this.state = "loading";
		try {
			this.doc = await hn(this.moduleType, this.documentId), this.state = "loaded", this.errorKey = null, this.notFoundOrForbidden = !1;
		} catch (e) {
			this.applyError(e);
		}
		await this.render();
	}
	async refresh() {
		this.state = "loading", await this.render();
		try {
			this.doc = await gn(this.moduleType, this.documentId), this.state = "loaded", this.errorKey = null, this.notFoundOrForbidden = !1;
		} catch (e) {
			this.applyError(e);
		}
		await this.render();
	}
	applyError(e) {
		p.warn("Atlas Foundry: failed to load document", e), this.doc = null, this.state = "error", this.errorKey = V(e), this.notFoundOrForbidden = e instanceof R || e instanceof z;
	}
	handleMentionActivate(e, t, n) {
		if (n && e !== "custom") {
			let n = this.doc?.campaignId ?? h.getLinkedCampaignId();
			n && window.open(F(n, e, t), "_blank");
			return;
		}
		G({
			moduleType: e,
			documentId: t
		});
	}
	openInAtlas() {
		if (!this.doc) return;
		let e = this.doc.moduleType === "custom" ? F(this.doc.campaignId, "custom", this.doc.id, this.doc.customModuleId) : F(this.doc.campaignId, this.doc.moduleType, this.doc.id);
		window.open(e, "_blank");
	}
	async _renderHTML() {
		let e = document.createElement("article");
		if (e.className = "atlas-foundry-viewer", this.state === "loading") return e.innerHTML = `<div class="atlas-foundry-viewer-skeleton">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Loading"))}</div>`, e;
		if (this.state === "error") return e.innerHTML = `
        <div class="atlas-foundry-viewer-error">
          ${this.notFoundOrForbidden ? `<p class="atlas-foundry-viewer-unavailable">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Unavailable"))}</p>` : ""}
          <p>${foundry.utils.escapeHTML(o(this.errorKey ?? "ATLASFOUNDRY.ApiError.Unknown"))}</p>
          <button type="button" data-action="retry">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Retry"))}</button>
        </div>
      `, e;
		let t = this.doc, n = t.heroImageUrl || t.imageUrl || "", r = new Intl.DateTimeFormat(game.i18n.lang, {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(new Date(t.updatedAt)), i = t.readAccess?.includes("all") ?? !0, s = t.moduleType === "custom" ? An : a[t.moduleType], c = t.moduleType === "custom" ? t.customModuleLabel ?? o("ATLASFOUNDRY.Search.CustomModule") : o(`ATLASFOUNDRY.ModuleTypes.${t.moduleType}`);
		e.innerHTML = `
      <header class="atlas-foundry-viewer-header">
        ${n ? `<img src="${foundry.utils.escapeHTML(n)}" alt="">` : ""}
        <div class="atlas-foundry-viewer-heading">
          <h2>${foundry.utils.escapeHTML(t.name)}</h2>
          <div class="atlas-foundry-viewer-badges">
            <span class="atlas-foundry-badge"><i class="${s}"></i> ${foundry.utils.escapeHTML(c)}</span>
            ${i ? "" : `<span class="atlas-foundry-badge atlas-foundry-badge-restricted">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.RestrictedBadge"))}</span>`}
            ${t.tags.map((e) => `<span class="atlas-foundry-tag">${foundry.utils.escapeHTML(e)}</span>`).join("")}
          </div>
        </div>
      </header>
      <div class="atlas-foundry-viewer-toolbar">
        <button type="button" data-action="refresh">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Refresh"))}</button>
        <button type="button" data-action="open-atlas">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.OpenInAtlas"))}</button>
      </div>
      <section class="atlas-foundry-viewer-body" data-body></section>
      <footer class="atlas-foundry-viewer-footer">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.UpdatedAt", { date: r }))}</footer>
    `;
		let l = e.querySelector("[data-body]"), u = await kn(t.entry, { onMentionActivate: (e, t, n) => this.handleMentionActivate(e, t, n) });
		return l?.appendChild(u), e;
	}
	async _replaceHTML(e, t) {
		t.replaceChildren(e), t.querySelector("[data-action=\"retry\"]")?.addEventListener("click", () => {
			this.load();
		}), t.querySelector("[data-action=\"refresh\"]")?.addEventListener("click", () => {
			this.refresh();
		}), t.querySelector("[data-action=\"open-atlas\"]")?.addEventListener("click", () => this.openInAtlas());
	}
	_onClose(e) {
		jn.delete(this.documentId), super._onClose(e);
	}
}, Nn = 3e4;
function Pn(e, t) {
	let n = new URLSearchParams();
	return n.set("q", t.q), t.types?.length && n.set("types", t.types.join(",")), t.nameOnly && n.set("nameOnly", "true"), t.limit && n.set("limit", String(t.limit)), `/foundry/campaigns/${e}/search?${n.toString()}`;
}
async function Fn(e, t = {}) {
	let n = h.getLinkedCampaignId();
	if (!n) throw new L("/foundry/campaigns/*/search", "Not logged in");
	let r = Pn(n, e);
	return W.getOrFetch(`${U}${r}`, Nn, () => H(r, { signal: t.signal }));
}
//#endregion
//#region src/search/search-controller.ts
var In = 300, Ln = 2;
function Rn() {
	return {
		status: "idle",
		query: "",
		results: [],
		errorKey: null
	};
}
var zn = class {
	onStateChange;
	state = Rn();
	debounceTimer = null;
	abortController = null;
	constructor(e) {
		this.onStateChange = e;
	}
	getState() {
		return this.state;
	}
	update(e, t = {}) {
		if (this.cancelPendingDebounce(), e.trim().length < Ln) {
			this.abortController?.abort(), this.abortController = null, this.setState({
				status: "idle",
				query: e,
				results: [],
				errorKey: null
			});
			return;
		}
		this.setState({
			...this.state,
			query: e,
			status: "loading"
		}), this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null, this.runSearch(e, t);
		}, In);
	}
	dispose() {
		this.cancelPendingDebounce(), this.abortController?.abort();
	}
	async runSearch(e, t) {
		this.abortController?.abort();
		let n = new AbortController();
		this.abortController = n;
		let r = {
			q: e,
			...t
		};
		try {
			let t = await Fn(r, { signal: n.signal });
			if (n.signal.aborted || this.state.query !== e) return;
			this.setState({
				status: "done",
				query: e,
				results: t.data,
				errorKey: null
			});
		} catch (t) {
			if (n.signal.aborted || this.state.query !== e) return;
			this.setState({
				status: "error",
				query: e,
				results: [],
				errorKey: V(t)
			});
		}
	}
	cancelPendingDebounce() {
		this.debounceTimer !== null && (clearTimeout(this.debounceTimer), this.debounceTimer = null);
	}
	setState(e) {
		this.state = e, this.onStateChange(e);
	}
}, K = null;
function Bn() {
	if (K) {
		K.bringToFront();
		return;
	}
	K = new Vn(), K.render(!0);
}
var Vn = class e extends foundry.applications.api.ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: "atlas-search",
		classes: ["atlas-foundry", "atlas-foundry-search"],
		window: {
			title: "ATLASFOUNDRY.Search.Title",
			icon: "fa-solid fa-search",
			resizable: !0
		},
		position: {
			width: 560,
			height: 640
		}
	};
	static pick(t = {}) {
		return new Promise((n) => {
			let r = new e({
				title: t.title,
				pickMode: !0
			});
			r.resolvePick = n, r.render(!0);
		});
	}
	pickMode;
	resolvePick = null;
	controller;
	selectedTypes = /* @__PURE__ */ new Set();
	nameOnly = !1;
	selectedIndex = -1;
	rootElement = null;
	constructor(e = {}) {
		super({ window: { title: e.title ?? "ATLASFOUNDRY.Search.Title" } }), this.pickMode = !!e.pickMode, this.controller = new zn((e) => this.onSearchStateChange(e));
	}
	async _renderHTML() {
		let e = document.createElement("section");
		return e.className = "atlas-foundry atlas-foundry-search", h.isLinked() ? (e.innerHTML = `
      <div class="atlas-foundry-row">
        <input type="search" name="q" autofocus placeholder="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Search.Placeholder"))}">
      </div>
      <div class="atlas-foundry-search-chips" data-chips>
        ${i.map((e) => `<button type="button" class="atlas-foundry-chip" data-type="${e}">${foundry.utils.escapeHTML(o(`ATLASFOUNDRY.ModuleTypes.${e}`))}</button>`).join("")}
      </div>
      <label class="atlas-foundry-toggle">
        <input type="checkbox" name="nameOnly">
        ${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Search.NameOnly"))}
      </label>
      <div class="atlas-foundry-status" data-status></div>
      <div class="atlas-foundry-search-results" data-results></div>
      <footer class="atlas-foundry-search-footer">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Search.PermissionHint"))}</footer>
    `, e) : (e.innerHTML = this.renderConnectPromptHtml(), e);
	}
	async _replaceHTML(e, t) {
		if (t.replaceChildren(e), this.rootElement = t, !h.isLinked()) {
			this.wireConnectPrompt(t);
			return;
		}
		this.wireSearchUi(t), this.onSearchStateChange(this.controller.getState());
	}
	_onClose(e) {
		if (K === this && (K = null), this.resolvePick) {
			let e = this.resolvePick;
			this.resolvePick = null, e(null);
		}
		this.controller.dispose(), super._onClose(e);
	}
	renderConnectPromptHtml() {
		let e = game.user.isGM || !!f(), t = o(e ? "ATLASFOUNDRY.NotConnected.Message" : "ATLASFOUNDRY.Login.PlayerWaitingForGm");
		return `
      <div class="atlas-foundry-status">${foundry.utils.escapeHTML(t)}</div>
      <button type="button" data-action="connect" ${e ? "" : "disabled"}>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.NotConnected.ConnectButton"))}</button>
    `;
	}
	wireConnectPrompt(e) {
		e.querySelector("[data-action=\"connect\"]")?.addEventListener("click", () => {
			g().catch(() => void 0);
		});
	}
	wireSearchUi(e) {
		let t = e.querySelector("input[name=\"q\"]");
		t?.addEventListener("input", () => this.triggerSearch(t.value)), t?.addEventListener("keydown", (e) => this.handleKeydown(e)), t?.focus(), e.querySelectorAll("[data-chips] [data-type]").forEach((e) => {
			e.addEventListener("click", () => {
				let n = e.dataset.type;
				this.selectedTypes.has(n) ? this.selectedTypes.delete(n) : this.selectedTypes.add(n), e.classList.toggle("active"), this.triggerSearch(t?.value ?? "");
			});
		}), e.querySelector("input[name=\"nameOnly\"]")?.addEventListener("change", (e) => {
			this.nameOnly = e.target.checked, this.triggerSearch(t?.value ?? "");
		});
	}
	triggerSearch(e) {
		this.controller.update(e, {
			types: [...this.selectedTypes],
			nameOnly: this.nameOnly
		});
	}
	handleKeydown(e) {
		let t = this.controller.getState();
		if (e.key === "Escape") {
			e.preventDefault(), this.pickMode ? this.resolveAndClose(null) : this.close();
			return;
		}
		if (e.key === "ArrowDown") {
			if (e.preventDefault(), !t.results.length) return;
			this.selectedIndex = Math.min(this.selectedIndex + 1, t.results.length - 1), this.updateSelectionHighlight();
			return;
		}
		if (e.key === "ArrowUp") {
			if (e.preventDefault(), !t.results.length) return;
			this.selectedIndex = Math.max(this.selectedIndex - 1, 0), this.updateSelectionHighlight();
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			let n = t.results[this.selectedIndex];
			n && this.activateResult(n, this.selectedIndex);
		}
	}
	onSearchStateChange(e) {
		this.selectedIndex = e.results.length ? 0 : -1, this.renderResults(e);
	}
	renderResults(e) {
		let t = this.rootElement?.querySelector("[data-status]"), n = this.rootElement?.querySelector("[data-results]");
		if (!(!t || !n)) {
			if (e.status === "idle") {
				t.textContent = o("ATLASFOUNDRY.Search.MinLength"), n.replaceChildren();
				return;
			}
			if (e.status === "loading") {
				t.textContent = o("ATLASFOUNDRY.Search.Searching");
				return;
			}
			if (e.status === "error") {
				t.textContent = o(e.errorKey ?? "ATLASFOUNDRY.ApiError.Unknown"), n.replaceChildren();
				return;
			}
			t.textContent = e.results.length ? o("ATLASFOUNDRY.Search.ResultCount", { count: e.results.length }) : o("ATLASFOUNDRY.Search.NoResults"), n.replaceChildren(), e.results.forEach((e, t) => n.appendChild(this.renderResultCard(e, t))), this.updateSelectionHighlight();
		}
	}
	renderResultCard(e, t) {
		let n = document.createElement("div");
		n.className = "atlas-foundry-search-card", n.dataset.index = String(t);
		let r = e.moduleType === "custom" ? "fa-solid fa-puzzle-piece" : a[e.moduleType], i = e.moduleType === "custom" ? e.customModuleLabel ?? o("ATLASFOUNDRY.Search.CustomModule") : o(`ATLASFOUNDRY.ModuleTypes.${e.moduleType}`), s = e.entryPlainText ? foundry.utils.escapeHTML(e.entryPlainText) : "";
		return n.innerHTML = `
      <div class="atlas-foundry-search-card-main">
        <strong><i class="${r}"></i> ${foundry.utils.escapeHTML(e.name)}${e.postTitle ? ` — ${foundry.utils.escapeHTML(e.postTitle)}` : ""}</strong>
        <span class="atlas-foundry-search-card-type">${foundry.utils.escapeHTML(i)}</span>
        ${s ? `<p class="atlas-foundry-search-card-snippet">${s}</p>` : ""}
        ${e.tags.length ? `<div class="atlas-foundry-search-card-badges">${e.tags.map((e) => `<span class="atlas-foundry-tag">${foundry.utils.escapeHTML(e)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="atlas-foundry-search-card-actions">
        <button type="button" data-action="open-atlas" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.OpenInAtlas"))}"><i class="fa-solid fa-up-right-from-square"></i></button>
        ${game.user.isGM ? `<button type="button" data-action="link" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Search.LinkAction"))}"><i class="fa-solid fa-link"></i></button>` : ""}
      </div>
    `, n.addEventListener("click", (n) => {
			n.target.closest("[data-action]") || this.activateResult(e, t);
		}), n.querySelector("[data-action=\"open-atlas\"]")?.addEventListener("click", (t) => {
			t.stopPropagation(), this.openInAtlas(e);
		}), game.user.isGM && n.querySelector("[data-action=\"link\"]")?.addEventListener("click", (t) => {
			t.stopPropagation(), globalThis.AtlasFoundry.pickTarget?.(e);
		}), n;
	}
	updateSelectionHighlight() {
		let e = this.rootElement?.querySelector("[data-results]");
		e && (e.querySelectorAll(".atlas-foundry-search-card").forEach((e) => {
			e.classList.toggle("selected", Number(e.dataset.index) === this.selectedIndex);
		}), e.querySelector(".atlas-foundry-search-card.selected")?.scrollIntoView({ block: "nearest" }));
	}
	activateResult(e, t) {
		if (this.selectedIndex = t, this.pickMode) {
			this.resolveAndClose(e);
			return;
		}
		G({
			moduleType: e.moduleType,
			documentId: e.id,
			name: e.name
		});
	}
	openInAtlas(e) {
		let t = h.getLinkedCampaignId();
		if (!t) return;
		let n = e.moduleType === "custom" ? F(t, "custom", e.id, e.customModuleId) : F(t, e.moduleType, e.id);
		window.open(n, "_blank");
	}
	resolveAndClose(e) {
		let t = this.resolvePick;
		this.resolvePick = null, t?.(e), this.close();
	}
}, Hn = "links", Un = 1;
function Wn(e) {
	if (!e || typeof e != "object") return !1;
	let t = e;
	return typeof t.id == "string" && typeof t.documentId == "string" && typeof t.moduleType == "string" && typeof t.nameSnapshot == "string" && typeof t.createdAt == "number" && (t.label === void 0 || typeof t.label == "string");
}
function q(e) {
	let t = e.getFlag(n, Hn);
	return !t || t.version !== Un || !Array.isArray(t.items) ? [] : t.items.filter(Wn);
}
async function Gn(e, t) {
	let r = {
		version: Un,
		items: t
	};
	await e.setFlag(n, Hn, r);
}
async function Kn(e, t) {
	let n = t.label?.trim(), r = {
		id: foundry.utils.randomID(),
		documentId: t.documentId,
		moduleType: t.moduleType,
		nameSnapshot: t.nameSnapshot,
		createdAt: Date.now(),
		...n ? { label: n } : {}
	};
	return await Gn(e, [...q(e), r]), r;
}
async function qn(e, t, n) {
	let r = n.trim();
	await Gn(e, q(e).map((e) => {
		if (e.id !== t) return e;
		let n = { ...e };
		return r ? n.label = r : delete n.label, n;
	}));
}
async function Jn(e, t) {
	await Gn(e, q(e).filter((e) => e.id !== t));
}
//#endregion
//#region src/links/link-visibility.ts
var Yn = 6e4, Xn = 250, Zn = 100;
function J(e) {
	return `${e.moduleType}:${e.documentId}`;
}
function Qn(e, t) {
	let n = [];
	for (let r = 0; r < e.length; r += t) n.push(e.slice(r, r + t));
	return n;
}
var Y = new class {
	cache = new dn();
	queued = /* @__PURE__ */ new Map();
	resolvers = /* @__PURE__ */ new Map();
	timer = null;
	async check(e) {
		let t = /* @__PURE__ */ new Map(), n = !1;
		return await Promise.all(e.map(async (e) => {
			let r = J(e);
			try {
				let n = await this.cache.getOrFetch(r, Yn, () => this.enqueue(e));
				n !== null && t.set(r, n);
			} catch {
				n = !0;
			}
		})), {
			isVisible: (e) => t.has(J(e)),
			nameFor: (e) => t.get(J(e)),
			failed: n
		};
	}
	async isVisible(e) {
		let t = await this.check([e]);
		return {
			visible: t.isVisible(e),
			name: t.nameFor(e),
			failed: t.failed
		};
	}
	enqueue(e) {
		let t = J(e);
		return new Promise((n, r) => {
			this.queued.set(t, e), this.resolvers.set(t, {
				resolve: n,
				reject: r
			}), this.timer === null && (this.timer = setTimeout(() => {
				this.timer = null, this.flush();
			}, Xn));
		});
	}
	async flush() {
		let e = [...this.queued.values()], t = new Map(this.resolvers);
		if (this.queued.clear(), this.resolvers.clear(), e.length !== 0) try {
			let n = h.getLinkedCampaignId();
			if (!n) throw new L("/foundry/campaigns/*/documents/visibility-check", "Not logged in");
			let r = /* @__PURE__ */ new Map();
			for (let t of Qn(e, Zn)) {
				let e = await H(`/foundry/campaigns/${n}/documents/visibility-check`, {
					method: "POST",
					body: { refs: t.map((e) => ({
						documentId: e.documentId,
						moduleType: e.moduleType
					})) }
				});
				for (let t of e.visible) r.set(`${t.moduleType}:${t.documentId}`, t.name);
			}
			for (let [e, n] of t) n.resolve(r.has(e) ? r.get(e) : null);
		} catch (e) {
			for (let n of t.values()) n.reject(e);
		}
	}
}();
function $n(e) {
	return e.map((e) => ({
		documentId: e.documentId,
		moduleType: e.moduleType
	}));
}
//#endregion
//#region src/links/link-manager-app.ts
var er = "fa-solid fa-puzzle-piece";
function tr(e) {
	new nr(e).render(!0);
}
var nr = class extends foundry.applications.api.ApplicationV2 {
	static DEFAULT_OPTIONS = {
		classes: ["atlas-foundry", "atlas-foundry-link-manager"],
		window: {
			title: "ATLASFOUNDRY.Links.ManagerTitle",
			icon: "fa-solid fa-link",
			resizable: !0
		},
		position: {
			width: 480,
			height: 480
		}
	};
	target;
	rows = [];
	loading = !0;
	checkFailed = !1;
	constructor(e) {
		super({ window: { title: e.name } }), this.target = e, this.load();
	}
	async load() {
		this.loading = !0, await this.render();
		let e = q(this.target.doc), t = await Y.check($n(e));
		this.rows = e.map((e) => ({
			link: e,
			currentName: t.nameFor(e),
			broken: !t.isVisible(e)
		})), this.checkFailed = t.failed, this.loading = !1, await this.render();
	}
	async _renderHTML() {
		let e = document.createElement("section");
		return e.className = "atlas-foundry atlas-foundry-link-manager", e.innerHTML = `
      <p class="atlas-foundry-link-privacy-hint">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.PrivacyHint"))}</p>
      ${this.checkFailed ? `<p class="atlas-foundry-status-error">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.CheckFailed"))}</p>` : ""}
      <div class="atlas-foundry-link-list" data-list>
        ${this.loading ? `<p class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Loading"))}</p>` : this.renderRows()}
      </div>
      <button type="button" data-action="add"><i class="fa-solid fa-plus"></i> ${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.AddButton"))}</button>
    `, e;
	}
	renderRows() {
		return this.rows.length === 0 ? `<p class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.Empty"))}</p>` : this.rows.map((e) => this.renderRow(e)).join("");
	}
	renderRow(e) {
		let t = e.link.moduleType === "custom" ? er : a[e.link.moduleType] ?? er, n = e.currentName ?? e.link.nameSnapshot, r = e.link.moduleType === "custom" ? o("ATLASFOUNDRY.Search.CustomModule") : o(`ATLASFOUNDRY.ModuleTypes.${e.link.moduleType}`) || e.link.moduleType;
		return `
      <div class="atlas-foundry-link-row${e.broken ? " atlas-foundry-link-row-broken" : ""}" data-link-id="${foundry.utils.escapeHTML(e.link.id)}">
        <div class="atlas-foundry-link-row-main">
          <strong><i class="${t}"></i> ${foundry.utils.escapeHTML(n)}</strong>
          <span class="atlas-foundry-link-row-type">${foundry.utils.escapeHTML(r)}</span>
          ${e.broken ? `<span class="atlas-foundry-badge atlas-foundry-badge-restricted">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.Broken"))}</span>` : ""}
          <input
            type="text"
            class="atlas-foundry-link-label-input"
            data-action="label"
            value="${foundry.utils.escapeHTML(e.link.label ?? "")}"
            placeholder="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.LabelPlaceholder"))}"
          >
        </div>
        <div class="atlas-foundry-link-row-actions">
          <button type="button" data-action="open" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Title"))}"><i class="fa-solid fa-eye"></i></button>
          <button type="button" data-action="remove" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.Remove"))}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
	}
	async _replaceHTML(e, t) {
		t.replaceChildren(e), t.querySelector("[data-action=\"add\"]")?.addEventListener("click", () => void this.handleAdd()), t.querySelectorAll("[data-link-id]").forEach((e) => {
			let t = e.dataset.linkId;
			e.querySelector("[data-action=\"open\"]")?.addEventListener("click", () => this.handleOpen(t)), e.querySelector("[data-action=\"remove\"]")?.addEventListener("click", () => void this.handleRemove(t));
			let n = e.querySelector("[data-action=\"label\"]");
			n?.addEventListener("change", () => void this.handleLabelChange(t, n.value));
		});
	}
	async handleAdd() {
		let e = await Vn.pick({ title: o("ATLASFOUNDRY.Links.PickTitle") });
		e && (await Kn(this.target.doc, {
			documentId: e.id,
			moduleType: e.moduleType,
			nameSnapshot: e.name
		}), await this.load());
	}
	handleOpen(e) {
		let t = this.rows.find((t) => t.link.id === e);
		t && G({
			moduleType: t.link.moduleType,
			documentId: t.link.documentId,
			name: t.currentName ?? t.link.nameSnapshot
		});
	}
	async handleRemove(e) {
		await Jn(this.target.doc, e), await this.load();
	}
	async handleLabelChange(e, t) {
		await qn(this.target.doc, e, t), await this.load();
	}
};
//#endregion
//#region src/links/link-actions.ts
function rr(e, t = {}) {
	let n = t.currentName ?? e.label ?? e.nameSnapshot;
	if (t.external && e.moduleType !== "custom") {
		let t = h.getLinkedCampaignId();
		if (t) {
			window.open(F(t, e.moduleType, e.documentId), "_blank");
			return;
		}
	}
	G({
		moduleType: e.moduleType,
		documentId: e.documentId,
		name: n
	});
}
//#endregion
//#region src/links/link-popover.ts
var ir = "fa-solid fa-puzzle-piece", ar = null, or = null;
function sr() {
	ar &&= (ar.remove(), null), or &&= (document.removeEventListener("pointerdown", or, !0), null);
}
function cr(e, t) {
	let n = t.getBoundingClientRect();
	e.style.position = "fixed", e.style.top = `${n.bottom + 4}px`, e.style.left = `${n.left}px`;
}
async function lr(e, t) {
	sr();
	let n = document.createElement("div");
	n.className = "atlas-foundry atlas-foundry-links-popover", n.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Loading"))}</div>`, document.body.appendChild(n), cr(n, t), ar = n, or = (e) => {
		n.contains(e.target) || t.contains(e.target) || sr();
	}, document.addEventListener("pointerdown", or, !0);
	let r = await Y.check($n(e));
	if (ar !== n) return;
	if (r.failed) {
		n.innerHTML = `<div class="atlas-foundry-status-error">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.CheckFailed"))}</div>`;
		return;
	}
	let i = e.filter((e) => r.isVisible(e));
	if (i.length === 0) {
		n.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.NoneVisible"))}</div>`;
		return;
	}
	n.innerHTML = i.map((e) => {
		let t = e.moduleType === "custom" ? ir : a[e.moduleType] ?? ir, n = e.label ?? r.nameFor(e) ?? e.nameSnapshot;
		return `
        <button type="button" class="atlas-foundry-links-popover-item" data-link-id="${foundry.utils.escapeHTML(e.id)}">
          <i class="${t}"></i> <span>${foundry.utils.escapeHTML(n)}</span>
        </button>
      `;
	}).join(""), n.querySelectorAll("[data-link-id]").forEach((e) => {
		let t = i.find((t) => t.id === e.dataset.linkId);
		t && e.addEventListener("click", (e) => {
			sr(), rr(t, {
				external: e.shiftKey || e.ctrlKey || e.metaKey,
				currentName: r.nameFor(t)
			});
		});
	});
}
//#endregion
//#region src/links/link-entry-points.ts
function ur() {
	Hooks.on("getHeaderControlsApplicationV2", (e, t) => {
		let n = e.document;
		if (!n || typeof n.getFlag != "function") return;
		if (game.user.isGM) {
			t.push({
				icon: "fa-solid fa-link",
				label: "ATLASFOUNDRY.Links.HeaderButton",
				action: "atlasLinks",
				onClick: () => tr({
					doc: n,
					name: n.name ?? ""
				})
			});
			return;
		}
		let r = q(n);
		r.length !== 0 && t.push({
			icon: "fa-solid fa-link",
			label: "ATLASFOUNDRY.Links.HeaderButton",
			action: "atlasLinks",
			onClick: (e) => {
				let t = e.currentTarget ?? e.target;
				lr(r, t);
			}
		});
	});
}
function dr() {
	Hooks.on("getSceneNavigationContext", (e, t) => {
		game.user.isGM && t.push({
			name: "ATLASFOUNDRY.Links.ManagerTitle",
			icon: "<i class=\"fa-solid fa-link\"></i>",
			callback: (e) => {
				let t = e.dataset.sceneId, n = t ? game.scenes.get(t) : void 0;
				n && tr({
					doc: n,
					name: n.name ?? ""
				});
			}
		});
	});
}
function fr() {
	Hooks.on("getSceneControlButtons", (e) => {
		if (!game.user.isGM) return;
		let t = e.tokens;
		t?.tools && (t.tools.atlasSceneLinks = {
			name: "atlasSceneLinks",
			title: "ATLASFOUNDRY.Links.SceneControlTool",
			icon: "fa-solid fa-link",
			button: !0,
			order: 101,
			onChange: () => {
				let e = canvas?.scene;
				e && tr({
					doc: e,
					name: e.name ?? ""
				});
			}
		});
	});
}
function pr() {
	ur(), dr(), fr();
}
//#endregion
//#region src/links/scene-links-bar.ts
var mr = "atlas-foundry-scene-links-bar", hr = 6, gr = "fa-solid fa-puzzle-piece", _r = 0;
function vr() {
	document.getElementById(mr)?.remove();
}
function yr(e) {
	return e === "custom" ? gr : a[e] ?? gr;
}
function br(e, t, n) {
	let r = document.createElement("button");
	if (r.type = "button", r.className = `atlas-foundry-scene-link-chip atlas-foundry-scene-link-chip-${n}`, r.title = e.label ?? t, r.innerHTML = `${n === "unknown" ? "<i class=\"fa-solid fa-question\"></i> " : ""}<i class="${yr(e.moduleType)}"></i> <span>${foundry.utils.escapeHTML(e.label ?? t)}</span>`, n === "broken") {
		let t = document.createElement("span");
		return t.className = "atlas-foundry-scene-link-chip-remove", t.innerHTML = "<i class=\"fa-solid fa-xmark\"></i>", t.title = o("ATLASFOUNDRY.Links.Remove"), t.addEventListener("click", (t) => {
			t.stopPropagation();
			let n = canvas?.scene;
			n && Jn(n, e.id).then(() => void Sr());
		}), r.appendChild(t), r;
	}
	return r.addEventListener("click", (n) => {
		rr(e, {
			external: n.shiftKey || n.ctrlKey || n.metaKey,
			currentName: t
		});
	}), r;
}
function xr(e) {
	let t = document.createElement("button");
	return t.type = "button", t.className = "atlas-foundry-scene-link-chip atlas-foundry-scene-link-chip-overflow", t.textContent = `+${e.length}`, t.addEventListener("click", () => void lr(e, t)), t;
}
async function Sr() {
	let e = ++_r, t = canvas?.scene;
	if (!t || !ae() || !h.isLinked()) {
		vr();
		return;
	}
	let n = q(t);
	if (n.length === 0) {
		vr();
		return;
	}
	let r = await Y.check($n(n));
	if (e !== _r || canvas?.scene !== t) return;
	let i = game.user.isGM, a = n.filter((e) => r.isVisible(e)).map((e) => ({
		link: e,
		name: r.nameFor(e) ?? e.nameSnapshot
	})), o = i && !r.failed ? n.filter((e) => !r.isVisible(e)) : [], s = i && r.failed ? n.filter((e) => !r.isVisible(e)) : [];
	if (a.length === 0 && o.length === 0 && s.length === 0) {
		vr();
		return;
	}
	let c = document.getElementById(mr) ?? document.createElement("div");
	c.id = mr, c.className = "atlas-foundry atlas-foundry-scene-links-bar", c.replaceChildren();
	let l = a.slice(0, hr), u = a.slice(hr);
	l.forEach(({ link: e, name: t }) => c.appendChild(br(e, t, "visible"))), o.forEach((e) => c.appendChild(br(e, e.nameSnapshot, "broken"))), s.forEach((e) => c.appendChild(br(e, e.nameSnapshot, "unknown"))), u.length > 0 && c.appendChild(xr(u.map((e) => e.link))), c.isConnected || (document.getElementById("ui-top") ?? document.body).appendChild(c);
}
function Cr() {
	Sr();
}
function wr() {
	Hooks.on("canvasReady", Cr), Hooks.on("updateScene", (e) => {
		canvas?.scene?.id === e.id && Cr();
	}), Hooks.on("atlas-foundry.authChanged", Cr), Hooks.on("atlas-foundry.showSceneLinksChanged", Cr);
}
//#endregion
//#region src/links/token-hud.ts
function Tr(e) {
	let t = q(e.document), n = e.actor ? q(e.actor) : [];
	return [...t, ...n];
}
function Er(e, t, n) {
	let r = document.createElement("button");
	return r.type = "button", r.className = "control-icon atlas-foundry-token-hud-button", r.title = t, r.innerHTML = `<i class="${e}"></i>`, r.addEventListener("click", n), r;
}
function Dr() {
	Hooks.on("renderTokenHUD", (e, t) => {
		let n = e.object;
		if (!n) return;
		let r = t instanceof HTMLElement ? t : t?.[0];
		if (!r) return;
		let i = Tr(n), a = game.user.isGM;
		if (i.length === 0 && !a) return;
		let s = r.querySelector(".col.right") ?? r;
		i.length > 0 && s.appendChild(Er("fa-solid fa-map", o("ATLASFOUNDRY.Links.ViewButton"), (e) => {
			(async () => {
				let t = await Y.check($n(i)), n = i.filter((e) => t.isVisible(e));
				if (n.length !== 0) {
					if (n.length === 1) {
						let r = n[0];
						rr(r, {
							external: e.shiftKey || e.ctrlKey || e.metaKey,
							currentName: t.nameFor(r)
						});
						return;
					}
					lr(n, e.currentTarget);
				}
			})();
		})), a && s.appendChild(Er("fa-solid fa-link", o("ATLASFOUNDRY.Links.EditButton"), () => {
			tr({
				doc: n.document,
				name: n.document.name ?? ""
			});
		}));
	});
}
//#endregion
//#region src/links/link-pick-target.ts
function Or(e) {
	return !!e && typeof e.getFlag == "function" && typeof e.setFlag == "function";
}
function kr() {
	let e = [], t = /* @__PURE__ */ new Set(), n = (n, r) => {
		!Or(r) || t.has(r) || (t.add(r), e.push({
			label: n,
			doc: r
		}));
	}, r = canvas?.scene;
	r && n(o("ATLASFOUNDRY.Links.PickTargetScene", { name: r.name ?? "" }), r);
	for (let e of canvas?.tokens?.controlled ?? []) n(o("ATLASFOUNDRY.Links.PickTargetToken", { name: e.document.name ?? "" }), e.document);
	for (let e of Object.values(ui.windows ?? {})) {
		let t = e?.document;
		t && n(o("ATLASFOUNDRY.Links.PickTargetSheet", { name: t.name ?? "" }), t);
	}
	return e;
}
async function Ar(e) {
	if (!game.user.isGM) return;
	let t = kr();
	if (t.length === 0) {
		ui.notifications.warn(o("ATLASFOUNDRY.Links.NoTargets"));
		return;
	}
	let n = `
    <form class="atlas-foundry atlas-foundry-link-target-picker">
      <div class="form-group">
        ${t.map((e, t) => `
          <label class="atlas-foundry-row">
            <input type="radio" name="targetIndex" value="${t}" ${t === 0 ? "checked" : ""}>
            ${foundry.utils.escapeHTML(e.label)}
          </label>`).join("")}
      </div>
      <div class="form-group">
        <label>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.LabelPlaceholder"))}</label>
        <input type="text" name="label" placeholder="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.LabelPlaceholder"))}">
      </div>
    </form>
  `;
	await foundry.applications.api.DialogV2.prompt({
		window: { title: "ATLASFOUNDRY.Links.PickTitle" },
		content: n,
		ok: {
			label: "ATLASFOUNDRY.Links.AddButton",
			callback: async (n, r) => {
				let i = r.form.elements.namedItem("targetIndex"), a = t[Number(i?.value ?? "-1")];
				if (!a) return;
				let s = r.form.elements.namedItem("label")?.value ?? "";
				await Kn(a.doc, {
					documentId: e.id,
					moduleType: e.moduleType,
					nameSnapshot: e.name,
					label: s
				}), ui.notifications.info(o("ATLASFOUNDRY.Links.Added", { name: e.name }));
			}
		}
	}).catch(() => void 0);
}
//#endregion
//#region src/quests/quests-api.ts
var jr = 3e4;
function Mr(e, t) {
	let n = new URLSearchParams();
	t.status && n.set("status", t.status), t.limit && n.set("limit", String(t.limit));
	let r = n.toString();
	return `/foundry/campaigns/${e}/quests${r ? `?${r}` : ""}`;
}
async function Nr(e = {}, t = {}) {
	let n = h.getLinkedCampaignId();
	if (!n) throw new L("/foundry/campaigns/*/quests", "Not logged in");
	let r = Mr(n, e);
	return W.getOrFetch(`${U}${r}`, jr, () => H(r, { signal: t.signal }));
}
async function Pr(e = {}) {
	let t = h.getLinkedCampaignId();
	if (!t) throw new L("/foundry/campaigns/*/quests", "Not logged in");
	let n = Mr(t, e);
	return W.delete(`${U}${n}`), Nr(e);
}
//#endregion
//#region src/quests/quest-panel-app.ts
var Fr = [
	"open",
	"completed",
	"failed"
], Ir = {
	open: "fa-solid fa-circle",
	completed: "fa-solid fa-circle-check",
	failed: "fa-solid fa-circle-xmark"
}, X = null;
function Lr() {
	if (X) {
		X.bringToFront();
		return;
	}
	X = new zr(), X.render(!0);
}
function Rr(e) {
	let t = new Map(e.map((e) => [e.id, e]));
	function n(e) {
		let n = e, r = /* @__PURE__ */ new Set();
		for (; n?.parentId;) {
			if (r.has(n.id)) return !0;
			r.add(n.id);
			let i = t.get(n.parentId);
			if (i?.id === e.id) return !0;
			n = i;
		}
		return !1;
	}
	let r = e.filter((e) => !e.parentId || !t.has(e.parentId) || n(e)), i = new Set(r.map((e) => e.id)), a = /* @__PURE__ */ new Map();
	for (let t of e) i.has(t.id) || !t.parentId || (a.has(t.parentId) || a.set(t.parentId, []), a.get(t.parentId).push(t));
	let o = [];
	for (let e of r) {
		o.push({
			quest: e,
			indented: !1
		});
		for (let t of a.get(e.id) ?? []) o.push({
			quest: t,
			indented: !0
		});
	}
	let s = new Set(o.map((e) => e.quest.id));
	for (let t of e) s.has(t.id) || o.push({
		quest: t,
		indented: !1
	});
	return o;
}
var zr = class extends foundry.applications.api.ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: "atlas-quest-panel",
		classes: ["atlas-foundry", "atlas-foundry-quest-panel"],
		window: {
			title: "ATLASFOUNDRY.Quests.Title",
			icon: "fa-solid fa-scroll",
			resizable: !0
		},
		position: {
			width: 380,
			height: 560,
			...oe()
		}
	};
	state = "loading";
	errorKey = null;
	data = null;
	statusFilter = "open";
	collapsedGroups = /* @__PURE__ */ new Set(["completed", "failed"]);
	rootElement = null;
	constructor() {
		super({}), this.load();
	}
	async load() {
		this.state = "loading", await this.render();
		try {
			this.data = await Nr({ status: this.statusFilter }), this.state = "loaded", this.errorKey = null;
		} catch (e) {
			this.data = null, this.state = "error", this.errorKey = V(e);
		}
		await this.render();
	}
	async refresh() {
		this.state = "loading", await this.render();
		try {
			this.data = await Pr({ status: this.statusFilter }), this.state = "loaded", this.errorKey = null;
		} catch (e) {
			this.data = null, this.state = "error", this.errorKey = V(e);
		}
		await this.render();
	}
	async setStatusFilter(e) {
		this.statusFilter !== e && (this.statusFilter = e, await this.load());
	}
	async _renderHTML() {
		let e = document.createElement("section");
		if (e.className = "atlas-foundry atlas-foundry-quest-panel", !h.isLinked()) return e.innerHTML = `
        <div class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.NotConnected.Message"))}</div>
        <button type="button" data-action="connect">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.NotConnected.ConnectButton"))}</button>
      `, e;
		let t = en();
		return e.innerHTML = `
      <header class="atlas-foundry-quest-panel-header">
        <div class="atlas-foundry-status-row">
          <span class="atlas-foundry-dot atlas-foundry-dot-${t.color}"></span>
          <span data-header-status>${foundry.utils.escapeHTML(o(t.messageKey, t.messageData))}</span>
          <button type="button" data-action="refresh" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Refresh"))}"><i class="fa-solid fa-rotate"></i></button>
        </div>
        <div class="atlas-foundry-quest-panel-filters" data-filters>
          ${[
			"open",
			"completed",
			"failed",
			"all"
		].map((e) => `<button type="button" class="atlas-foundry-chip${this.statusFilter === e ? " active" : ""}" data-filter="${e}">${foundry.utils.escapeHTML(o(`ATLASFOUNDRY.Quests.Filter.${e}`))}</button>`).join("")}
        </div>
      </header>
      <div class="atlas-foundry-quest-panel-body" data-body></div>
    `, e.querySelector("[data-body]").appendChild(this.renderBody()), e;
	}
	renderBody() {
		let e = document.createElement("div");
		if (this.state === "loading") return e.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Loading"))}</div>`, e;
		if (this.state === "error") return e.innerHTML = `
        <div class="atlas-foundry-viewer-error">
          <p>${foundry.utils.escapeHTML(o(this.errorKey ?? "ATLASFOUNDRY.ApiError.Unknown"))}</p>
          <button type="button" data-action="retry">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Retry"))}</button>
        </div>
      `, e;
		let t = this.data?.quests ?? [];
		if (t.length === 0) return e.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Quests.Empty"))}</div>`, e;
		let n = {
			characters: this.buildRefLookup(this.data?.refs.characters),
			locations: this.buildRefLookup(this.data?.refs.locations)
		}, r = this.statusFilter === "all" ? Fr : [this.statusFilter];
		for (let i of r) {
			let r = t.filter((e) => e.status === i);
			r.length !== 0 && e.appendChild(this.renderGroup(i, r, n));
		}
		return e;
	}
	buildRefLookup(e) {
		return new Map((e ?? []).map((e) => [e.id, e.name]));
	}
	renderGroup(e, t, n) {
		let r = document.createElement("div");
		r.className = "atlas-foundry-quest-group";
		let i = this.collapsedGroups.has(e), a = document.createElement("button");
		if (a.type = "button", a.className = "atlas-foundry-quest-group-header", a.dataset.groupToggle = e, a.innerHTML = `<i class="fa-solid fa-chevron-${i ? "right" : "down"}"></i> ${foundry.utils.escapeHTML(o(`ATLASFOUNDRY.Quests.Filter.${e}`))} (${t.length})`, r.appendChild(a), !i) {
			let e = document.createElement("div");
			e.className = "atlas-foundry-quest-group-list";
			for (let r of Rr(t)) e.appendChild(this.renderQuestCard(r, n));
			r.appendChild(e);
		}
		return r;
	}
	renderQuestCard(e, t) {
		let { quest: n } = e, r = document.createElement("div");
		r.className = `atlas-foundry-quest-card${e.indented ? " atlas-foundry-quest-card-indented" : ""}`, r.dataset.questId = n.id;
		let i = [...n.characterIds.map((e) => ({
			id: e,
			moduleType: "characters",
			name: t.characters.get(e)
		})), ...n.locationIds.map((e) => ({
			id: e,
			moduleType: "locations",
			name: t.locations.get(e)
		}))].filter((e) => !!e.name);
		return r.innerHTML = `
      <div class="atlas-foundry-quest-card-title">
        <i class="${Ir[n.status]} atlas-foundry-quest-status-icon atlas-foundry-quest-status-${n.status}"></i>
        <span data-action="open-viewer">${foundry.utils.escapeHTML(n.name)}</span>
        ${n.isGmOnly ? `<i class="fa-solid fa-shield-halved atlas-foundry-quest-gm-icon" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Quests.GmOnlyHint"))}"></i>` : ""}
        <button type="button" data-action="open-atlas" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.OpenInAtlas"))}"><i class="fa-solid fa-up-right-from-square"></i></button>
      </div>
      ${n.entryPlainText ? `<p class="atlas-foundry-quest-card-snippet">${foundry.utils.escapeHTML(n.entryPlainText)}</p>` : ""}
      ${i.length ? `<div class="atlas-foundry-quest-card-refs">${i.map((e) => `<button type="button" class="atlas-foundry-tag" data-ref-id="${foundry.utils.escapeHTML(e.id)}" data-ref-type="${e.moduleType}">${foundry.utils.escapeHTML(e.name)}</button>`).join("")}</div>` : ""}
    `, r;
	}
	async _replaceHTML(e, t) {
		t.replaceChildren(e), this.rootElement = t, t.querySelector("[data-action=\"connect\"]")?.addEventListener("click", () => {
			g().catch(() => void 0);
		}), t.querySelector("[data-action=\"refresh\"]")?.addEventListener("click", () => void this.refresh()), t.querySelector("[data-action=\"retry\"]")?.addEventListener("click", () => void this.load()), t.querySelectorAll("[data-filters] [data-filter]").forEach((e) => {
			e.addEventListener("click", () => void this.setStatusFilter(e.dataset.filter));
		}), t.querySelectorAll("[data-group-toggle]").forEach((e) => {
			e.addEventListener("click", () => {
				let t = e.dataset.groupToggle;
				this.collapsedGroups.has(t) ? this.collapsedGroups.delete(t) : this.collapsedGroups.add(t), this.render();
			});
		}), t.querySelectorAll("[data-quest-id]").forEach((e) => {
			let t = e.dataset.questId, n = this.data?.quests.find((e) => e.id === t);
			n && (e.querySelector("[data-action=\"open-viewer\"]")?.addEventListener("click", () => {
				G({
					moduleType: "quests",
					documentId: n.id,
					name: n.name
				});
			}), e.querySelector("[data-action=\"open-atlas\"]")?.addEventListener("click", (e) => {
				e.stopPropagation();
				let t = h.getLinkedCampaignId();
				t && window.open(F(t, "quests", n.id), "_blank");
			}), e.querySelectorAll("[data-ref-id]").forEach((e) => {
				e.addEventListener("click", (t) => {
					t.stopPropagation();
					let n = e.dataset.refType;
					G({
						moduleType: n,
						documentId: e.dataset.refId,
						name: e.textContent ?? void 0
					});
				});
			}));
		});
	}
	_onClose(e) {
		X === this && (X = null);
		let { top: t, left: n, width: r, height: i } = this.position;
		se({
			top: t,
			left: n,
			width: r,
			height: i
		}), super._onClose(e);
	}
};
function Br() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t?.tools && (t.tools.atlasQuests = {
			name: "atlasQuests",
			title: "ATLASFOUNDRY.Quests.ControlTool",
			icon: "fa-solid fa-scroll",
			button: !0,
			order: 102,
			onChange: () => Lr()
		});
	}), Hooks.on("atlas-foundry.socketEvent", (e, t) => {
		t?.documentModuleType === "quests" && X && X.refresh();
	});
}
//#endregion
//#region src/notifications/notifications-api.ts
function Vr(e) {
	let t = h.getLinkedCampaignId();
	if (!t) throw new L(`/campaigns/*/messages${e}`, "Not logged in");
	return `/campaigns/${t}/messages${e}`;
}
async function Hr(e = {}, t = {}) {
	let n = new URLSearchParams();
	e.folder && n.set("folder", e.folder), e.unread && n.set("unread", "true"), e.limit && n.set("limit", String(e.limit)), e.cursor && n.set("cursor", e.cursor);
	let r = n.toString();
	return H(Vr(r ? `?${r}` : ""), { signal: t.signal });
}
async function Ur(e = {}) {
	return (await H(Vr("/unread-count"), { signal: e.signal })).count;
}
async function Wr(e) {
	return H(Vr(`/${e}/read`), { method: "PATCH" });
}
async function Gr(e) {
	return H(Vr(`/${e}/dismiss`), { method: "PATCH" });
}
//#endregion
//#region src/notifications/notification-store.ts
var Kr = 30, qr = 3 * 6e4, Jr = 10 * 6e4, Z = new class {
	items = [];
	unreadCount = 0;
	status = "idle";
	pollTimer = null;
	started = !1;
	getState() {
		return {
			items: this.items,
			unreadCount: this.unreadCount,
			status: this.status
		};
	}
	start() {
		this.started || (this.started = !0, Hooks.on("atlas-foundry.authChanged", (e) => {
			e.state === "active" ? this.resync() : this.reset();
		}), Hooks.on("atlas-foundry.socketEvent", (e, t) => {
			e === "notification:new" && this.handleWakeup(t);
		}), Hooks.on("atlas-foundry.socketStatusChanged", () => this.reschedulePolling()), h.isLinked() && this.resync(), this.reschedulePolling());
	}
	async resync() {
		if (!h.isLinked()) {
			this.reset();
			return;
		}
		this.status = "loading", this.notify();
		try {
			let [e, t] = await Promise.all([Ur(), Hr({ limit: Kr })]);
			this.unreadCount = e, this.items = t, this.status = "idle";
		} catch (e) {
			this.status = "error", p.warn("Atlas Foundry: notification sync failed", e);
		}
		this.notify();
	}
	async markRead(e) {
		let t = this.items.find((t) => t.id === e);
		if (!(!t || t.isRead)) {
			t.isRead = !0, this.unreadCount = Math.max(0, this.unreadCount - 1), this.notify();
			try {
				await Wr(e);
			} catch (e) {
				t.isRead = !1, this.unreadCount += 1, this.notify(), m(e, "ATLASFOUNDRY.Notifications.ActionFailed");
			}
		}
	}
	async dismiss(e) {
		let t = this.items.findIndex((t) => t.id === e);
		if (t === -1) return;
		let n = this.items[t], r = !n.isRead;
		this.items = this.items.filter((t) => t.id !== e), r && (this.unreadCount = Math.max(0, this.unreadCount - 1)), this.notify();
		try {
			await Gr(e);
		} catch (e) {
			this.items = [
				...this.items.slice(0, t),
				n,
				...this.items.slice(t)
			], r && (this.unreadCount += 1), this.notify(), m(e, "ATLASFOUNDRY.Notifications.ActionFailed");
		}
	}
	handleWakeup(e) {
		let t = e;
		t?.subject && !ce() && ui.notifications.info(o("ATLASFOUNDRY.Notifications.NewToast", { subject: t.subject })), this.resync();
	}
	reset() {
		this.items = [], this.unreadCount = 0, this.status = "idle", this.notify();
	}
	reschedulePolling() {
		this.pollTimer &&= (clearInterval(this.pollTimer), null);
		let e = N.getStatus() === "connected" ? Jr : qr;
		this.pollTimer = setInterval(() => void this.resync(), e);
	}
	notify() {
		Hooks.callAll("atlas-foundry.notificationsChanged", this.getState());
	}
}(), Yr = {
	"gm-announcement": "fa-solid fa-bullhorn",
	"document-new": "fa-solid fa-file-circle-plus",
	"document-updated": "fa-solid fa-file-pen"
}, Xr = 20, Zr = "atlas-foundry-suggest-toast", Qr = 2e4, Q = null;
function $r() {
	if (Q) {
		Q.bringToFront();
		return;
	}
	Q = new ti(), Q.render(!0);
}
function ei(e) {
	let t = Math.round((Date.now() - new Date(e).getTime()) / 6e4);
	if (t < 1) return o("ATLASFOUNDRY.Notifications.JustNow");
	if (t < 60) return o("ATLASFOUNDRY.Notifications.MinutesAgo", { count: t });
	let n = Math.round(t / 60);
	return n < 24 ? o("ATLASFOUNDRY.Notifications.HoursAgo", { count: n }) : o("ATLASFOUNDRY.Notifications.DaysAgo", { count: Math.round(n / 24) });
}
var ti = class extends foundry.applications.api.ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: "atlas-notification-center",
		classes: ["atlas-foundry", "atlas-foundry-notification-center"],
		window: {
			title: "ATLASFOUNDRY.Notifications.Title",
			icon: "fa-solid fa-bell",
			resizable: !0
		},
		position: {
			width: 380,
			height: 520
		}
	};
	filter = "unread";
	markingAllRead = !1;
	onStoreChange = () => {
		this.render();
	};
	constructor() {
		super({}), Hooks.on("atlas-foundry.notificationsChanged", this.onStoreChange);
	}
	async _renderHTML() {
		let e = document.createElement("section");
		e.className = "atlas-foundry atlas-foundry-notification-center";
		let t = Z.getState(), n = this.filter === "unread" ? t.items.filter((e) => !e.isRead) : t.items;
		e.innerHTML = `
      <header class="atlas-foundry-notification-center-header">
        <div class="atlas-foundry-quest-panel-filters">
          ${["unread", "all"].map((e) => `<button type="button" class="atlas-foundry-chip${this.filter === e ? " active" : ""}" data-filter="${e}">${foundry.utils.escapeHTML(o(`ATLASFOUNDRY.Notifications.Filter.${e}`))}</button>`).join("")}
        </div>
        <button type="button" data-action="mark-all-read" ${this.markingAllRead ? "disabled" : ""}>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Notifications.MarkAllRead"))}</button>
      </header>
      <div class="atlas-foundry-notification-center-body" data-body></div>
    `;
		let r = e.querySelector("[data-body]");
		return t.status === "loading" && n.length === 0 ? r.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Viewer.Loading"))}</div>` : t.status === "error" && n.length === 0 ? r.innerHTML = `<div class="atlas-foundry-status-error">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.ApiError.Unknown"))}</div>` : n.length === 0 ? r.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Notifications.Empty"))}</div>` : n.forEach((e) => r.appendChild(this.renderItem(e))), e;
	}
	renderItem(e) {
		let t = document.createElement("div");
		t.className = `atlas-foundry-notification-item${e.isRead ? "" : " atlas-foundry-notification-item-unread"}`, t.dataset.messageId = e.id;
		let n = Yr[e.kind] ?? "fa-solid fa-bell", r = e.subject || e.documentName || o("ATLASFOUNDRY.Notifications.NoSubject"), i = game.user.isGM && !!e.documentId && !!e.documentModuleType;
		return t.innerHTML = `
      <div class="atlas-foundry-notification-item-main" data-action="open">
        <i class="${n}"></i>
        <div class="atlas-foundry-notification-item-text">
          <strong>${foundry.utils.escapeHTML(r)}</strong>
          ${e.bodyPlainText ? `<p>${foundry.utils.escapeHTML(e.bodyPlainText)}</p>` : ""}
          <span class="atlas-foundry-notification-item-time">${foundry.utils.escapeHTML(ei(e.createdAt))}</span>
        </div>
        ${e.isRead ? "" : "<span class=\"atlas-foundry-notification-item-dot\"></span>"}
      </div>
      <div class="atlas-foundry-notification-item-actions">
        ${e.isRead ? "" : `<button type="button" data-action="read" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Notifications.MarkRead"))}"><i class="fa-solid fa-check"></i></button>`}
        <button type="button" data-action="dismiss" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Links.Remove"))}"><i class="fa-solid fa-xmark"></i></button>
        ${i ? `<button type="button" data-action="broadcast" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Notifications.Broadcast"))}"><i class="fa-solid fa-tower-broadcast"></i></button>` : ""}
      </div>
    `, t;
	}
	async _replaceHTML(e, t) {
		t.replaceChildren(e), t.querySelectorAll("[data-filter]").forEach((e) => {
			e.addEventListener("click", () => {
				this.filter = e.dataset.filter, this.render();
			});
		}), t.querySelector("[data-action=\"mark-all-read\"]")?.addEventListener("click", () => void this.markAllRead()), t.querySelectorAll("[data-message-id]").forEach((e) => {
			let t = Z.getState().items.find((t) => t.id === e.dataset.messageId);
			t && (e.querySelector("[data-action=\"open\"]")?.addEventListener("click", () => this.openItem(t)), e.querySelector("[data-action=\"read\"]")?.addEventListener("click", (e) => {
				e.stopPropagation(), Z.markRead(t.id);
			}), e.querySelector("[data-action=\"dismiss\"]")?.addEventListener("click", (e) => {
				e.stopPropagation(), Z.dismiss(t.id);
			}), e.querySelector("[data-action=\"broadcast\"]")?.addEventListener("click", (e) => {
				e.stopPropagation(), this.broadcast(t);
			}));
		});
	}
	openItem(e) {
		if (e.isRead || Z.markRead(e.id), e.documentId && e.documentModuleType) {
			G({
				moduleType: e.documentModuleType,
				documentId: e.documentId,
				name: e.documentName
			});
			return;
		}
		let t = h.getLinkedCampaignId();
		t && window.open(rn(t), "_blank");
	}
	broadcast(e) {
		!e.documentId || !e.documentModuleType || (game.socket.emit(r, {
			type: "suggest-open",
			moduleType: e.documentModuleType,
			documentId: e.documentId,
			documentName: e.documentName
		}), ui.notifications.info(o("ATLASFOUNDRY.Notifications.BroadcastSent")));
	}
	async markAllRead() {
		let e = Z.getState().items.filter((e) => !e.isRead);
		e.length > Xr && ui.notifications.info(o("ATLASFOUNDRY.Notifications.MarkAllReadManyHint", { count: e.length })), this.markingAllRead = !0, await this.render();
		for (let t of e) await Z.markRead(t.id);
		this.markingAllRead = !1, await this.render();
	}
	_onClose(e) {
		Q === this && (Q = null), Hooks.off("atlas-foundry.notificationsChanged", this.onStoreChange), super._onClose(e);
	}
};
function ni(e, t) {
	document.getElementById(Zr)?.remove();
	let n = document.createElement("div");
	n.id = Zr, n.className = "atlas-foundry atlas-foundry-suggest-toast", n.innerHTML = `
    <span>${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Notifications.SuggestOpenToast", { name: e }))}</span>
    <button type="button" data-action="open">${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Notifications.SuggestOpenButton"))}</button>
    <button type="button" data-action="close" title="${foundry.utils.escapeHTML(o("ATLASFOUNDRY.Login.Cancel"))}"><i class="fa-solid fa-xmark"></i></button>
  `, document.body.appendChild(n);
	let r = () => n.remove();
	n.querySelector("[data-action=\"open\"]")?.addEventListener("click", () => {
		t(), r();
	}), n.querySelector("[data-action=\"close\"]")?.addEventListener("click", r), setTimeout(r, Qr);
}
function ri() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t?.tools && (t.tools.atlasNotifications = {
			name: "atlasNotifications",
			title: "ATLASFOUNDRY.Notifications.ControlTool",
			icon: "fa-solid fa-bell",
			button: !0,
			order: 103,
			onChange: () => $r()
		});
	});
}
function ii() {
	game.socket.on(r, (e) => {
		let t = e;
		if (t?.type !== "suggest-open" || !t.moduleType || !t.documentId) return;
		let n = () => G({
			moduleType: t.moduleType,
			documentId: t.documentId,
			name: t.documentName
		});
		if (le()) {
			n();
			return;
		}
		ni(t.documentName ?? "", n);
	});
}
//#endregion
//#region src/notifications/bell.ts
var ai = "atlas-foundry-bell";
function oi() {
	document.getElementById(ai)?.remove();
}
function si(e) {
	let t = document.getElementById("players");
	t?.parentElement ? t.parentElement.insertBefore(e, t) : document.body.appendChild(e);
}
function ci() {
	let e = document.createElement("button");
	return e.id = ai, e.type = "button", e.className = "atlas-foundry-bell", e.innerHTML = "<i class=\"fa-solid fa-bell\"></i><span class=\"atlas-foundry-bell-badge\" data-badge hidden></span>", e.addEventListener("click", () => $r()), e;
}
function $() {
	if (!h.isLinked() || !ue()) {
		oi();
		return;
	}
	let e = document.getElementById(ai);
	(!e || !e.isConnected) && (e ??= ci(), si(e));
	let t = e.querySelector("[data-badge]");
	if (!t) return;
	let { unreadCount: n } = Z.getState();
	n > 0 ? (t.textContent = n > 99 ? "99+" : String(n), t.hidden = !1) : t.hidden = !0;
}
function li() {
	Hooks.on("atlas-foundry.notificationsChanged", $), Hooks.on("atlas-foundry.authChanged", $), Hooks.on("atlas-foundry.showBellChanged", $), Hooks.on("renderPlayers", $), $();
}
//#endregion
//#region src/main.ts
function di() {
	Hooks.on("renderSettings", (e, t) => {
		if (!game.user.isGM) return;
		let n = document.createElement("button");
		n.type = "button", n.innerHTML = `<i class="fa-solid fa-book-open"></i> ${game.i18n.localize("ATLASFOUNDRY.Settings.MenuButton")}`, n.addEventListener("click", () => {
			tn().catch((e) => p.error("Failed to open settings dialog", e));
		}), (t instanceof HTMLElement ? t : t?.[0])?.querySelector("#settings-game")?.append(n);
	});
}
function fi() {
	Hooks.on("atlas-foundry.authChanged", (e) => {
		e.state === "active" ? N.start() : N.stop();
	}), Hooks.on("atlas-foundry.baseUrlChanged", () => {
		h.invalidateCache(), N.getStatus() !== "disconnected" && N.restart();
	});
}
function pi() {
	game.keybindings.register(n, "openSearch", {
		name: "ATLASFOUNDRY.Search.KeybindingName",
		editable: [{
			key: "KeyK",
			modifiers: ["Control"]
		}],
		onDown: () => (Bn(), !0)
	});
}
function mi() {
	game.keybindings.register(n, "openQuests", {
		name: "ATLASFOUNDRY.Quests.KeybindingName",
		editable: [{
			key: "KeyQ",
			modifiers: ["Control", "Shift"]
		}],
		onDown: () => (Lr(), !0)
	});
}
Hooks.once("init", () => {
	u(), pi(), mi();
}), Hooks.once("ready", async () => {
	await fe(), pe(Bn), di(), fi(), pr(), wr(), Dr(), Br(), li(), ri(), ii(), Z.start(), await h.restore(), p.info("ready");
}), globalThis.AtlasFoundry = {
	openSearch: Bn,
	openSettings: tn,
	openLogin: g,
	logout: () => h.logout(),
	pickTarget: (e) => void Ar(e),
	pickDocument: (e) => Vn.pick({ title: e }),
	openQuests: Lr,
	openNotifications: $r
};
//#endregion
