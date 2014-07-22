from tornado import web, ioloop, websocket, iostream
import time
import socket
import protocols
from ConfigParser import ConfigParser

apphost = appport = None

def main():
    global appport, apphost
    config = ConfigParser()
    config.read('config.cfg')
    apphost = config.get('core', 'host')
    appport = config.getint('core', 'port')
    settings = { "static_path" : "static" }
    app = web.Application([(r'/ws', SocketPassthrough),
                           (r'/static/(.*)', web.StaticFileHandler, {"path":
                               "static"}),
                           (r'/(index\.html)?', IndexHandler),
                           (r'/(favicon\.ico)', web.StaticFileHandler, {'path': './static/favicon.ico'})], **settings)
    app.listen(appport)
    ioloop.IOLoop.instance().start()


class IndexHandler(web.RequestHandler):
    def get(self, dummy):
        self.render("templates/index.html", host=apphost, port=appport)


class SocketPassthrough(websocket.WebSocketHandler):
    # Encodes a base 128 varint, to be used as a length header for outgoing packets to the SVMP server.
    def encodeVarint(self, value):
        def getByte(val):
            tmpval = ''
            if val.bit_length() < 7:
                tmpval = bin(val)[2:]
                while len(tmpval) < 7:
                    tmpval = '0' + tmpval
            else:
                tmpval = bin(val)[len(bin(val)) - 7:]
            tmpval = int(tmpval, 2)
            val >>= 7
            if val != 0:
                tmpval |= 1 << 7
            else:
                tmpval &= ~(1 << 7)
            return val, tmpval

        endbytes = []
        value, tmpvalue = getByte(value)
        endbytes.append(tmpvalue)
        while value != 0:
            value, tmpvalue = getByte(value)
            endbytes.append(tmpvalue)
        return ''.join([chr(i) for i in endbytes])

    # Takes Response messages from the SVMP server and wraps them in Container messages to send to the browser.
    def wrapResponse(self, responsebytes):
        cont = protocols.container_pb2.Container()
        cont.ctype = protocols.container_pb2.Container.RESPONSE
        cont.response.ParseFromString(responsebytes)
        msg = cont.SerializeToString()
        self.write_message(msg, binary=True)
        # Start reading another Response - we want to send everything to the browser as soon as it gets here.
        self.connstream.read_bytes(1, callback=self.readResponseHeader)

    # Reads a varint length header from an incoming message from the SVMP server.
    # Reads 1 byte at a time and determines if it's the final byte in the varint;
    # if not read another byte, otherwise decode the varint and read that number of
    # bytes, then wrap it and send it to the browser via wrapResponse.
    def readResponseHeader(self, headerByte, readBytes=None):
        headerByte = ord(headerByte)
        readBytes = readBytes or []
        if headerByte & (1 << 7):
            self.connstream.read_bytes(1, lambda x : self.readResponseHeader(x, readBytes + [headerByte]))
        else:
            fullHeader = readBytes + [headerByte]
            varintlist = []
            for i in fullHeader:
                j = bin(i)
                k = j[3:] if len(j) > 9 else j[2:]
                while len(k) < 7:
                    k = ''.join(['0', k])
                varintlist.append(k)
            varintlist = varintlist[::-1]
            varintstr = ''.join(varintlist)
            varint = int(varintstr, 2)
            self.connstream.read_bytes(varint, self.wrapResponse)

    # Called when the websocket is opened.
    def open(self):
        self.set_nodelay(True)
        self.keepalive = ioloop.PeriodicCallback(lambda : self.ping(str(time.time())), 30000)
        self.keepalive.start()
        self.connected = False
        self.connstream = None
        print('Client acquired')

    # Called when the websocket is closed.
    def on_close(self):
        if self.keepalive:
            self.keepalive.stop()
        if self.connstream is not None:
            self.connstream.close()
        print('Client lost')

    # Called when the websocket receives a message from the browser.
    # Interpret it as a Container message. If it's a connect directive,
    # open the socket to the SVMP server, tell the browser we have done so,
    # and start reading from the socket. If it's a Request message, pass it
    # to the socket to the SVMP server. Otherwise it's garbage.
    def on_message(self, message):
        cont = protocols.container_pb2.Container()
        cont.ParseFromString(message)
        if cont.ctype == protocols.container_pb2.Container.CONNECT:
            host = cont.proxyhost
            port = cont.proxyport
            self.rawsock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
            self.connstream = iostream.IOStream(self.rawsock)
            self.connstream.connect((host, port))
            self.connected = True
            connack = protocols.container_pb2.Container()
            connack.ctype = protocols.container_pb2.Container.CONNECTED
            self.write_message(connack.SerializeToString(), binary=True)
            self.connstream.read_bytes(1, callback=self.readResponseHeader)
        elif cont.ctype == protocols.container_pb2.Container.REQUEST:
            msg = cont.request.SerializeToString()
            self.connstream.write(self.encodeVarint(len(msg)) + msg)
            #self.connstream.read_bytes(1, callback=self.readResponseHeader)
        else:
            print('Bad message received!')

    def select_subprotocol(self, subprotocols):
        pass

    def on_pong(self, data):
        pass


if __name__ == '__main__':
    main()
