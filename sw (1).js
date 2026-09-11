/*
 * sw.js — 슼터디 서비스 워커
 *
 * 서비스 워커는 브라우저와 네트워크 사이에 끼어드는 별도의 백그라운드 스크립트입니다.
 * 이 파일 덕분에 두 가지가 가능해집니다.
 *   1) "홈 화면에 추가"가 가능한 설치형 앱이 됨 (manifest.json과 함께 필요)
 *   2) 껍데기(index.html, 아이콘 등)를 캐시해 두어서, 네트워크가 잠깐 끊겨도
 *      완전히 하얀 화면 대신 앱이 일단 뜨게 함
 *
 * 주의: Firestore의 실시간 데이터(스터디 목록, 채팅 등)는 여기서 캐시하지 않습니다.
 * 그건 항상 최신 상태여야 의미가 있으니까요. 캐시하는 건 "껍데기"뿐입니다.
 */

const CACHE_NAME = 'schstudy-shell-v1'; // 파일을 크게 바꿔 배포할 때 v1 → v2로 올리면 캐시가 자동 갱신됩니다
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* 1) 설치 시점: 앱 셸 파일들을 미리 내려받아 캐시에 저장 */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting(); // 새 버전을 기다리지 않고 바로 활성화
});

/* 2) 활성화 시점: 이전 버전 캐시(CACHE_NAME이 바뀌었을 때)를 정리 */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

/* 3) 요청 가로채기: "네트워크 우선, 실패하면 캐시" 전략
 *    - Firebase(Firestore/Auth 등 다른 도메인) 요청은 절대 손대지 않고 그대로 통과시킵니다.
 *    - 같은 출처(같은 도메인)의 GET 요청만 오프라인 대비용으로 캐시에 저장합니다.
 */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return; // 손대지 않음 → 원래대로 네트워크로 나감
  }
  event.respondWith(
    fetch(req)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
