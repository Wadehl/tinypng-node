# tinypng-node
一个基于NodeJS的tinypng脚本

## Features
1. 并发调度：默认每10s上传15张
2. 错误重试：压缩报错（429）的图片会进行错误重试，重新进行压缩
3. 本地缓存：通过MD5编码判断是否已缓存，缓存MD5保存在本地JSON中
