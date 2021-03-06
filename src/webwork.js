export default () => `
var ADLER32;
  (function (factory) {
    /*jshint ignore:start */
    /*eslint-disable */
    if (typeof DO_NOT_EXPORT_ADLER === 'undefined') {
      if ('object' === typeof exports) {
        factory(exports);
      } else if ('function' === typeof define && define.amd) {
        define(function () {
          var module = {};
          factory(module);
          return module;
        });
      } else {
        factory(ADLER32 = {});
      }
    } else {
      factory(ADLER32 = {});
    }
    /*eslint-enable */
    /*jshint ignore:end */
  }(function (ADLER32) {
    ADLER32.version = '1.2.0';
    function adler32_bstr(bstr, seed) {
      var a = 1, b = 0, L = bstr.length, M = 0;
      if (typeof seed === 'number') { a = seed & 0xFFFF; b = seed >>> 16; }
      for (var i = 0; i < L;) {
        M = Math.min(L - i, 3850) + i;
        for (; i < M; i++) {
          a += bstr.charCodeAt(i) & 0xFF;
          b += a;
        }
        a = (15 * (a >>> 16) + (a & 65535));
        b = (15 * (b >>> 16) + (b & 65535));
      }
      return ((b % 65521) << 16) | (a % 65521);
    }

    function adler32_buf(buf, seed) {
      var a = 1, b = 0, L = buf.length, M = 0;
      if (typeof seed === 'number') { a = seed & 0xFFFF; b = (seed >>> 16) & 0xFFFF; }
      for (var i = 0; i < L;) {
        M = Math.min(L - i, 3850) + i;
        for (; i < M; i++) {
          a += buf[i] & 0xFF;
          b += a;
        }
        a = (15 * (a >>> 16) + (a & 65535));
        b = (15 * (b >>> 16) + (b & 65535));
      }
      return ((b % 65521) << 16) | (a % 65521);
    }

    function adler32_str(str, seed) {
      var a = 1, b = 0, L = str.length, M = 0, c = 0, d = 0;
      if (typeof seed === 'number') { a = seed & 0xFFFF; b = seed >>> 16; }
      for (var i = 0; i < L;) {
        M = Math.min(L - i, 3850);
        while (M > 0) {
          c = str.charCodeAt(i++);
          if (c < 0x80) { a += c; }
          else if (c < 0x800) {
            a += 192 | ((c >> 6) & 31); b += a; --M;
            a += 128 | (c & 63);
          } else if (c >= 0xD800 && c < 0xE000) {
            c = (c & 1023) + 64; d = str.charCodeAt(i++) & 1023;
            a += 240 | ((c >> 8) & 7); b += a; --M;
            a += 128 | ((c >> 2) & 63); b += a; --M;
            a += 128 | ((d >> 6) & 15) | ((c & 3) << 4); b += a; --M;
            a += 128 | (d & 63);
          } else {
            a += 224 | ((c >> 12) & 15); b += a; --M;
            a += 128 | ((c >> 6) & 63); b += a; --M;
            a += 128 | (c & 63);
          }
          b += a; --M;
        }
        a = (15 * (a >>> 16) + (a & 65535));
        b = (15 * (b >>> 16) + (b & 65535));
      }
      return ((b % 65521) << 16) | (a % 65521);
    }
    // $FlowIgnore
    ADLER32.bstr = adler32_bstr;
    // $FlowIgnore
    ADLER32.buf = adler32_buf;
    // $FlowIgnore
    ADLER32.str = adler32_str;
  }));



  let SIZE = 2048;

  self.importScripts("https://cdn.bootcss.com/spark-md5/3.0.0/spark-md5.min.js");

  const getChunks = (file) => {
    const chunks = [];

    let start = 0, end = 0;
    while (true) {
      end += SIZE;
      const part = file.slice(start, end);
      start += SIZE;
      if (part.size) {
        chunks.push(part);
      } else {
        break;
      }
    }

    return chunks;
  }

  const checkKey = (md5Arr, adler32, md5Value) => {
    if (md5Arr[adler32]) {
      const sameIndex = 1;
      while (true) {
        const key = adler32 + '@' + sameIndex;

        if (!md5Arr[key]) {
          md5Arr[key] = md5Value;
          break;
        };

        sameIndex++;
      };
    } else {
      md5Arr[adler32] = md5Value;
    }
  }

  const getMd5Index = (md5Value) => {
    const index = md5Value.lastIndexOf('@');
    return {
      md5: md5Value.slice(0, index),
      index: md5Value.slice(index + 1)
    }
  }

  const judgeStartEnd = (start, end) => {
    if (start === end) {
      return start;
    } else {
      return [start, end];
    }
  }

  const handleCheckResult = (checkResult) => {
    console.log(checkResult);
    const blobArr = [];
    const result = [];
    let start = null, end = null;

    for (let i = 0; i < checkResult.length; i++) {
      if (checkResult[i] instanceof Blob) {
        if (start !== null) {
          result.push(judgeStartEnd(start, end));
          start = null;
          end = null;
        }

        blobArr.push({
          i: result.length,
          blob: checkResult[i]
        });
        result.push(null);
        continue;
      };

      const num = ~~checkResult[i];

      if (start !== null) {

        if (num === end + 1) {
          end = num;
          continue;
        }

        result.push(judgeStartEnd(start, end));

        start = num;
        end = num;

      } else {
        start = num;
        end = num;
      }
    };

    if (start !== null) {
      result.push(judgeStartEnd(start, end));
    }

    return {
      blobArr,
      checkResult: result
    }
  };

  self.onmessage = (e) => {
    const { type } = e.data;

    if (type === 'GET_SIGN') {
      const chunkList = getChunks(e.data.file);
      let spark = new self.SparkMD5.ArrayBuffer();
      let count = 0;
      let md5Arr = {};
      const loadNext = function (index) {
        const reader = new FileReader();
        reader.readAsArrayBuffer(chunkList[index]);
        reader.onload = function (e) {
          const result = e.target.result;

          count++;
          spark.append(result);

          const md5Value = spark.end() + '@' + index;
          const adler32 = ADLER32.buf(new Uint8Array(result));

          checkKey(md5Arr, adler32, md5Value);

          spark = new self.SparkMD5.ArrayBuffer();

          if (count === chunkList.length) {
            self.postMessage({
              result: JSON.stringify(md5Arr)
            });
          } else {
            loadNext(count);
          }
        };
      };

      loadNext(0);
    } else if (type === 'GET_DELTA') {
      const { file } = e.data;
      const sign = JSON.parse(e.data.sign);


      const checkResult = [];

      let start = 0, end = SIZE, fragmentIndex = 0;

      const loadNext = () => {
        const part = file.slice(start, end);
        let has = false;

        if (!part.size) {
          // end
          if (!has) {
            checkResult.push(file.slice(fragmentIndex));
          }
          self.postMessage({
            result: handleCheckResult(checkResult)
          });
          return;
        }

        const reader = new FileReader();
        reader.readAsArrayBuffer(part);
        reader.onload = function (e) {

          const result = e.target.result;
          const adler32 = ADLER32.buf(new Uint8Array(result));

          if (sign[adler32]) {

            const spark = new self.SparkMD5.ArrayBuffer();
            spark.append(result);
            const md5 = spark.end();

            const valueObj = getMd5Index(sign[adler32]);

            if (md5 === valueObj.md5) {

              if (start !== fragmentIndex) {
                checkResult.push(file.slice(fragmentIndex, start));
              }

              checkResult.push(valueObj.index);
              start += SIZE;
              end += SIZE;
              has = true;
              fragmentIndex = start;
            } else {
              const sameIndex = 1;
              let key = adler32 + '@' + sameIndex;

              while (sign[key]) {
                const valueObj = getMd5Index(sign[key]);

                if (md5 === valueObj.md5) {

                  if (start !== fragmentIndex) {
                    checkResult.push(file.slice(fragmentIndex, start));
                  }

                  checkResult.push(valueObj.index);
                  start += SIZE;
                  end += SIZE;
                  has = true;
                  fragmentIndex = start;
                  break;
                };

                sameIndex++;
                key = adler32 + '@' + sameIndex;
              }
            }

            if (!has) {
              start++;
              end++;
            }

          } else {
            start++;
            end++;
          }

          // 判断窗口是否到了末尾
          if (part.size < SIZE) {
            if (!has) {
              checkResult.push(file.slice(fragmentIndex));
            }
            self.postMessage({
              result: handleCheckResult(checkResult)
            });
          } else {
            loadNext();
          }

        };
      };

      loadNext();
    }
  }
`;