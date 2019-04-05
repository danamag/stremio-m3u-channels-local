const modules = require('./modules')

const defaults = {
	name: 'M3U Playlists',
	prefix: 'm3uplaylist_',
	icon: 'https://enjoy.zendesk.com/hc/article_attachments/360004422752/2149-m3u-image.jpg'
}

const m3us = {}

function getM3U(url) {
	return new Promise((resolve, reject) => {
		if (m3us[url]) {
			resolve(m3us[url])
			return 
		}
		const m3u = modules.get['m3u8-reader']

		modules.get.needle.get(url, (err, resp, body) => {
			if (!err && body) {
				const playlist = m3u(body)
				const videos = []
				let title
				playlist.forEach(line => {
					if (typeof line == 'string') {
						videos.push({
							id: defaults.prefix + 'url_' + encodeURIComponent(line),
							title
						})
						title = false
					} else if (typeof line == 'object' && line.EXTINF) {
						for (let key in line.EXTINF)
							if (key != '-1 tvg-id' && !title)
								title = key
					}
				})
				if (videos.length)
					m3us[url] = videos
				resolve(videos)
			}
		})
	})
}

module.exports = {
	manifest: local => {
		modules.set(local.modules)
		return Promise.resolve({
			id: 'org.' + defaults.name.toLowerCase().replace(/[^a-z]+/g,''),
			version: '1.0.0',
			name: defaults.name,
			description: 'Add M3U playlists to Stremio by URL, supports a maximum of 5 playlists and custom names',
			resources: ['stream', 'meta', 'catalog'],
			types: ['tv', 'channel'],
			idPrefixes: [defaults.prefix],
			icon: defaults.icon,
			catalogs: [
				{
					id: defaults.prefix + 'cat',
					name: 'M3U Playlists',
					type: 'tv',
					extra: [{ name: 'search' }]
				}
			]
		})
	},
	handler: (args, local) => {
		modules.set(local.modules)
		const persist = local.persist
		const config = local.config
		const extra = args.extra || {}

	    if (!args.id)
	        return Promise.reject(new Error(defaults.name + ' - No ID Specified'))

		return new Promise((resolve, reject) => {

			if (args.resource == 'catalog') {
				const extra = args.extra || {}
				const metas = []
				for (let i = 1; i < 6; i++)
					if (config['m3u_url_'+i])
						metas.push({
							name: config['m3u_name_'+i] || ('Unnamed #' + i),
							id: defaults.prefix + i,
							type: 'channel',
							poster: defaults.icon,
							posterShape: 'landscape',
							background: defaults.icon,
							logo: defaults.icon
						})

				if (metas.length) {
					if (extra.search) {
						let results = []
						metas.forEach(meta => {
							if (meta.name.toLowerCase().includes(extra.search.toLowerCase()))
								results.push(meta)
						})
						if (results.length)
							resolve({ metas: results })
						else
							reject(defaults.name + ' - No search results for: ' + extra.search)
					} else
						resolve({ metas })
				} else
					reject(defaults.name + ' - No M3U URLs set')

			} else if (args.resource == 'meta') {
				const i = args.id.replace(defaults.prefix, '')
				const meta = {
					name: config['m3u_name_'+i] || ('Unnamed #' + i),
					id: defaults.prefix + i,
					type: 'channel',
					poster: defaults.icon,
					posterShape: 'landscape',
					background: defaults.icon,
					logo: defaults.icon
				}
				getM3U(config['m3u_url_'+i]).then(videos => {
					meta.videos = videos
					resolve({ meta })
				}).catch(err => {
					reject(err)
				})
			} else if (args.resource == 'stream') {
				const url = decodeURIComponent(args.id.replace(defaults.prefix + 'url_', ''))
				resolve({ streams: [{ url }] })
			}
		})
	}
}
