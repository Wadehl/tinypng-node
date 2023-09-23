const chalk = require('chalk');
const saveCache = require('./useCache').saveCache;

// 并发限制次数
class Scheduler {
    constructor(limit = 15) {
        this.fileQueue = [];
        this.errorQueue = [];
        this.limit = limit;
        this.running = 0;
        this.success = 0;
        this.failure = 0;
        this.finished = false;
    }

    add(promiseCreator) {
        this.fileQueue.push(promiseCreator);
    }

    start() {
        let n = this.limit;
        while (n--) {
            this.next();
        }
    }

    next() {
        if (this.running >= this.limit || !this.fileQueue.length) {
            if (this.running === 0 && !this.finished) {
                this.finished = true;
                setTimeout(() => {
                    console.log(
                        `压缩完成，成功：${chalk.green(this.success)}，失败：${chalk.red(
                            this.failure
                        )}`
                    );
                    saveCache();
                    if (this.errorQueue.length) {
                        console.log("10s后将重试失败的文件");
                        this.handleError();
                    }
                }, 10000);
            }
            return;
        }
        const promiseCreator = this.fileQueue.shift();
        this.running++;
        promiseCreator()
            .then(() => {
                this.running--;
                this.next();
            })
            .catch(() => {
                this.errorQueue.push(promiseCreator);
                this.running--;
                this.next();
            });
    }

    handleError() {
        if (this.running >= this.limit || !this.errorQueue.length) {
            if (this.running === 0) {
                setTimeout(() => {
                    if (this.failure > 0) {
                        this.handleError(); // 最后一个如果失败的话，这里这个流程会有问题，最后一个失败的会卡住流程且不重试，这里修复这个重试
                    } else {
                        saveCache();
                        console.log(
                            `${chalk.green("重试完成")}`
                        );
                    }
                }, 3000);
            }
            return;
        }
        const promiseCreator = this.errorQueue.shift();
        this.running++;
        this.failure--;
        promiseCreator()
            .then(() => {
                this.running--;
                this.handleError();
            })
            .catch(() => {
                this.errorQueue.push(promiseCreator);
                this.running--;
                this.handleError();
            });
    }
}

const timeout = (time) =>
    new Promise((resolve) => {
        setTimeout(resolve, time);
    });

exports.Scheduler = Scheduler;
exports.timeout = timeout;
