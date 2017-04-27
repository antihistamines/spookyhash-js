'use strict'

var Long = require('long')
var sc_const = new Long(0xdeadbeef, 0xdeadbeef, true)
var sc_numVars = 12
var sc_blockSize = sc_numVars * 8
var sc_bufSize = sc_blockSize * 2

var rot64 = function(x, n) {
	return x.shl(n).or(x.shru(64 - n))
}

var mix_stage = function(data, s, i, b) {
	var ip1 = (i+1)%12
	var ip2 = (i+2)%12
	var im1 = (i+11) %12
	var im2 = (i+10) %12
	s[i] = data[i].add(s[i])
	s[ip2] = s[ip2].xor(s[im2])
	s[im1] = s[im1].xor(s[i])
	s[i] = rot64(s[i], b)
	s[im1] = s[im1].add(s[ip1])
}

var mix = function(data, s) {
	mix_stage(data, s, 0, 11)
	mix_stage(data, s, 1, 32)
	mix_stage(data, s, 2, 43)
	mix_stage(data, s, 3, 31)
	mix_stage(data, s, 4, 17)
	mix_stage(data, s, 5, 28)
	mix_stage(data, s, 6, 39)
	mix_stage(data, s, 7, 57)
	mix_stage(data, s, 8, 55)
	mix_stage(data, s, 9, 54)
	mix_stage(data, s, 10, 22)
	mix_stage(data, s, 11, 46)
}

var end_partial_stage= function(h, i ,b) {
	var ip1 = (i+1)%12
	var ip2 = (i+2)%12
	var im1 = (i+11) %12
	h[im1] = h[im1].add(h[ip1])
	h[ip2] = h[ip2].xor(h[im1])
	h[ip1] = h[ip1].rot64(h[ip1], b)
}

var end_partial = function(h) {
	end_partial_stage(h, 0, 44)
	end_partial_stage(h, 1, 15)
	end_partial_stage(h, 2, 34)
	end_partial_stage(h, 3, 21)
	end_partial_stage(h, 4, 38)
	end_partial_stage(h, 5, 33)
	end_partial_stage(h, 6, 10)
	end_partial_stage(h, 7, 13)
	end_partial_stage(h, 8, 38)
	end_partial_stage(h, 9, 53)
	end_partial_stage(h, 10, 42)
	end_partial_stage(h, 11, 54)
}

var end = function(data, h) {
	h.forEach(function(e, i) {
		h[i] = h[i].add(data[i])
	})
	end_partial(h)
	end_partial(h)
	end_partial(h)
}

var short_mix_stage = function(h, i, b) {
	var ip2 = (i+2)%4
	var im1 = (i+3)%4
	h[ip2] = rot64(h[ip2], b)
	h[ip2] = h[ip2].add(h[im1])
	h[i] = h[i].xor(h[ip2])
}

var short_mix = function(h) {
	short_mix_stage(h, 0, 50)
	short_mix_stage(h, 1, 52)
	short_mix_stage(h, 2, 30)
	short_mix_stage(h, 3, 41)
	short_mix_stage(h, 0, 54)
	short_mix_stage(h, 1, 48)
	short_mix_stage(h, 2, 38)
	short_mix_stage(h, 3, 37)
	short_mix_stage(h, 0, 62)
	short_mix_stage(h, 1, 34)
	short_mix_stage(h, 2, 5)
	short_mix_stage(h, 3, 36)
}

var short_end_stage = function(h, i, b) {
	var ip2 = (i+2)%4
	var im1 = (i+3)%4
	h[im1] = h[im1].xor(h[ip2])
	h[ip2] = h[ip2].rot64(h[ip2], b)
	h[im1] = h[im1].add(h[ip2])
}

var short_end = function(h) {
	short_end_stage(h, 0, 15)
	short_end_stage(h, 1, 52)
	short_end_stage(h, 2, 26)
	short_end_stage(h, 3, 51)
	short_end_stage(h, 0, 28)
	short_end_stage(h, 1, 9)
	short_end_stage(h, 2, 47)
	short_end_stage(h, 3, 54)
	short_end_stage(h, 0, 32)
	short_end_stage(h, 1, 25)
	short_end_stage(h, 2, 63)
}

var short_hash = function(msg, seed1, seed2) {
	if (seed1 == null) {
		seed1 = Long.new(0, 0, true)
	} else {
		console.assert(Long.isLong(seed1), 'seed1 need to be Long')
	}
	if (seed2 == null) {
		seed2 = Long.new(0, 0, true)
	} else {
		console.assert(Long.isLong(seed1), 'seed1 need to be Long')
	}
	console.assert(Buffer.isBuffer(msg), 'msg need to be a Buffer')
	var remainder = msg.length % 32
	var a = seed1
	var b = seed2
	var c = sc_const
	var d = sc_const

	//setup a buffer
	var buf = Buffer.alloc(sc_bufSize)
	var offset = 0
	var loop_max = msg.length >> 5 << 2

	if (msg.length > 15) {
		var low, high
		// read 4 * 64bit = 32byte and mix
		// until less than 32byte left
		for (var i = 0; i < loop_max; i++) {
			low = msg.readUIntLE(offset, 4)
			offset += 4
			high = msg.readUIntLE(offset, 4)
			offset += 4
			c = c.add(Long.new(low, high))

			low = msg.readUIntLE(offset, 4)
			offset += 4
			high = msg.readUIntLE(offset, 4)
			offset += 4
			d = d.add(Long.new(low, high))

			short_mix([a,b,c,d])

			low = msg.readUIntLE(offset, 4)
			offset += 4
			high = msg.readUIntLE(offset, 4)
			offset += 4
			a = c.add(Long.new(low, high))

			low = msg.readUIntLE(offset, 4)
			offset += 4
			high = msg.readUIntLE(offset, 4)
			offset += 4
			b = c.add(Long.new(low, high))
		}

		// if remaining is 16 bytes or more
		if (remainder > 15) {
			low = msg.readUIntLE(offset, 4)
			offset += 4
			high = msg.readUIntLE(offset, 4)
			offset += 4
			c = c.add(Long.new(low, high))

			low = msg.readUIntLE(offset, 4)
			offset += 4
			high = msg.readUIntLE(offset, 4)
			offset += 4
			d = d.add(Long.new(low, high))

			short_mix([a,b,c,d])

			remainder -= 16
		}
		//TODO
	}
}
