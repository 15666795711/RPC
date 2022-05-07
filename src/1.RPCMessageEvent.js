/**
 * 远程过程调用（英语：Remote Procedure Call，RPC）是一个计算机通信协议。
 * 参考内容：
 * https://juejin.cn/post/7073156371008454663#heading-2
 * https://zh.wikipedia.org/wiki/%E9%81%A0%E7%A8%8B%E9%81%8E%E7%A8%8B%E8%AA%BF%E7%94%A8
 * 
 * 这里实现的相当于一个发布订阅，内部封装成promise进行返回
 */
class RPCMessageEvent{
  constructor(options){
    this._events = {}; // 存储调用事件
    this._currentEndpoint = options.currentEndpoint; // 消息发送方
    this._targetEndpoint = options.targetEndpoint; // 消息接收方
    this._targetOrigin = options.targetOrigin; // origin认证
    this._config = options.config
    if (options.methods) {
      Object.entries(options.methods).forEach(([method, handler]) => {
          this.registerMethod(method, handler);
      });
    }
    // 监听远程消息事件
    const receiveMessage = (event)=>{
      const {data} = event;
      const eventHandlers = this._events[data.event] || [];
      if (eventHandlers.length){
        eventHandlers.forEach((handler)=>{
          handler(...(data.args || []));
        });
        return;
      }
    };
    this._currentEndpoint.addEventListener(
      'message',
      receiveMessage,
      false
    );
    this._receiveMessage = receiveMessage;
  }
  registerMethod(method, handler) {
    const synEventName = `syn:${method}`;
    const ackEventName = `ack:${method}`;
    const synEventHandler = (data) => {
        Promise.resolve(handler(data))
            .then((result) => {
                this.emit(ackEventName, result);
            });
    };
    this.on(synEventName, synEventHandler);
  }
  invoke(method, ...args) {
    return new Promise((resolve) => {
        const synEventName = `syn:${method}`;
        const ackEventName = `ack:${method}`;
        this.emit(synEventName, ...args);
        this.on(ackEventName, (res) => {
            resolve(res);
        });
    });
  }
  // 发送消息
  emit(event, ...args){
    const data = {
      event,
      args,
    };
      // postMessage
    this._targetEndpoint.postMessage(data, this._targetOrigin);
  }
  // 注册消息事件
  on(event, fn){
    if (!this._events[event]){
      this._events[event] = [];
    }
    this._events[event].push(fn);
  }
  // 卸载消息事件
  off(event, fn){
    if (!this._events[event]) return;
    if (!fn){
      this._events[event] = [];
      return;
    }
    const handlers = this._events[event] || [];
    this._events[event] = handlers.filter((handler)=>handler !== fn);
  }
  // 卸载消息事件监听
  destroy() {
    if (this._currentEndpoint.removeEventListener) {
        this._currentEndpoint.removeEventListener(
            'message',
            this._receiveMessage,
            false
        );
        return;
    }
    try {
        // @ts-ignore
        this._currentEndpoint.onmessage = this._originOnmessage;
    } catch (error) {
        console.warn(error);
    }
  }
}

