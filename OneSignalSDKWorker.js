importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js')

class MasterServiceWorker {
    constructor() {
        this.name = 'ServiceWorker'
        this.version = 'v7'
        this.precache = [
            './',
            './index.html',
            './manifest.json',
            './favicon.gif'
        ]
        this.doNotIntercept = []
        this.doIntercept = [location.origin]
    }
    run() {
        this.addInstallEventListener()
        this.addActivateEventListener()
        this.addFetchEventListener()
    }
    // onInstall init cache
    addInstallEventListener() {
        self.addEventListener('install', event => event.waitUntil(caches.open(this.version).then(cache => cache.addAll(this.precache))))
    }
    // onActivate clear old caches to avoid conflict
    addActivateEventListener(){
        self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keyList => Promise.all(keyList.map(key => key !== this.version ? caches.delete(key) : undefined)))))
    }
    // intercepts fetches, asks cache for fast response and still fetches and caches afterwards
    addFetchEventListener() {
        self.addEventListener('fetch', event => event.respondWith(
            this.doNotIntercept.every(url => !event.request.url.includes(url)) && this.doIntercept.every(url => event.request.url.includes(url))
                ? new Promise((resolve, reject) => {
                    let counter = 0
                    let didResolve = false
                    const doResolve = response => {
                        counter++
                        if (!didResolve) {
                            if (response) {
                                didResolve = true
                                resolve(response)
                            } else if (counter >= 2) { // two which race, when none resulted in any useful response, reject
                                reject(response)
                            }
                        }
                        return response || new Error(`No response for ${event.request.url}`)
                    }
                    // race fetch vs. cache to resolve
                    this.getFetch(event).then(response => doResolve(response)).catch(error => { // start fetching and caching
                        console.info(`Can't fetch ${event.request.url}`, error)
                    })
                    this.getCache(event).then(response => doResolve(response)).catch(error => { // grab cache
                        console.info(`Can't get cache ${event.request.url}`, error)
                    })
                })
                : fetch(event.request)
        ))
    }
    async getCache(event) {
        return await caches.match(event.request)
    }
    async getFetch(event) {
        return await fetch(event.request).then(
            response => caches.open(this.version).then(
                cache => {
                    //console.log('cached', event.request.url)
                    cache.put(event.request, response.clone())
                    return response
                }
            )
        )
    }
}
const ServiceWorker = new MasterServiceWorker()
ServiceWorker.run()