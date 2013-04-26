!function( win, doc, host ){
  var local
    , globalConfig
    , localsys = {}
    , grantedBytes
    , baseQuota
    , request = win.requestFileSystem || win.webkitRequestFileSystem
    , resolveLocalFileSystemURL = window.resolveLocalFileSystemURL || window.webkitResolveLocalFileSystemURL
    , storageInfo = win.storageInfo || win.webkitStorageInfo
    , FileError = win.FileError
    , QUOTA_EXCEEDED_ERR = FileError && FileError.QUOTA_EXCEEDED_ERR
    , NOT_FOUND_ERR = FileError && FileError.NOT_FOUND_ERR
    , SECURITY_ERR = FileError && FileError.SECURITY_ERR
    , INVALID_MODIFICATION_ERR = FileError && FileError.INVALID_MODIFICATION_ERR
    , INVALID_STATE_ERR = FileError && FileError.INVALID_STATE_ERR
    , QUOTA_REQUEST_ERR
    , PERSISTENT = win.PERSISTENT
    , TEMPORARY = win.TEMPORARY

  localsys.isImagePath = function( filePath ){
    return /\.(jpe?g|png|gif)$/i.test(filePath)
  }
  localsys.isImage = function( pathOrFile ){
    return typeof pathOrFile == "string"
      ? /\.(jpe?g|png|gif)$/i.test(pathOrFile)
      : /image.*/.test(pathOrFile.type)
  }
  localsys.concatPath = function(){
    var path = arguments[0].toString().replace(/\/$/, "")
    for ( var i = 0, l = arguments.length; ++i < l; ) {
      path += "/" + arguments[i].toString().replace(/^\/|\/$/g, "")
    }
    return path
  }
  localsys.getPath = function( filePath ){
    return filePath.replace(/^(\/?.*)\/.*?$/, "$1")
  }
  localsys.getFileName = function( filePath ){
    return filePath.replace(/^(?:.*\/)?(.+)\..+$/, "$1")
  }
  localsys.parentPath = function( path ){
    return path.replace(/^(.+)\/$/, "$1").replace(/^(.+)\/.*?$/, "$1")
  }
  localsys.replacePath = function( filePath, newPath ){
    return filePath.replace(/(?:^.*\/|^)(.*?\.\w+)$/, newPath.replace(/\/$/, "") + "/$1")
  }
  localsys.renameFile = function( filePath, newName ){
    return filePath.replace(/(^.*\/|^).*(\.\w+)/, "$1" + newName + "$2")
  }
  localsys.stripExtension = function( path ){
    return path.replace(/^(.+)(\.\w+)$/, "$1")
  }

  /* file */
  localsys.readText = function( file, done ){
    var reader = new FileReader()
    reader.onloadend = function( e ){
      reader.onloadend = null
      done(this.result)
    }
    reader.readAsText(file)
  }
  localsys.readJSON = function( file, done, failed ){
    var reader = new FileReader()
    reader.onloadend = function( e ){
      reader.onloadend = null
      try {
        done(JSON.parse(this.result))
      }
      catch ( e ) {
        failed ? failed(e) : done(null, e)
      }
    }
    reader.readAsText(file)
  }

  localsys.readDataUrl = function( file, done ){
    var reader = new FileReader()
    reader.onloadend = function( e ){
      reader.onloadend = null
      done(this.result)
    }
    reader.readAsDataURL(file)
  }
  localsys.readBinary = function( file, done ){
    var reader = new FileReader()
    reader.onloadend = function( e ){
      reader.onloadend = null
      done(this.result)
    }
    reader.readAsBinaryString(file)
  }
  localsys.readBuffer = function( file, done ){
    var reader = new FileReader()
    reader.onloadend = function( e ){
      reader.onloadend = null
      done(this.result)
    }
    reader.readAsArrayBuffer(file)
  }

  localsys.datURLtoBlob = function( dataURL, type ){
    var binary = atob(dataURL.split(",")[1])
      , i = -1, l = binary.length
      , array = new Array(l)
    type = type && {type:type} || {}
    while ( ++i < l ) {
      array[i] = binary.charCodeAt(i)
    }
    return new Blob([new Uint8Array(array)], type)
  }
  localsys.imageDataToBlob = function( imageData ){
    var canvas = doc.createElement("canvas").getContext("2d")
    canvas.canvas.width = imageData.width
    canvas.canvas.height = imageData.height
    canvas.putImageData(imageData, 0, 0)
    return localsys.datURLtoBlob(canvas.canvas.toDataURL(imageData.type), imageData.type)
  }

  localsys.resizeImage = function( sourceImage, maxWidth, maxHeight, done ){
    var canvas = doc.createElement("canvas")
      , context = canvas.getContext("2d")
      , img = new Image()
      , width, height, ret
      , src, urlSrc

    function resize(  ){
      width = img.width
      height = img.height
      if ( width > height ) {
        if ( width > maxWidth ) {
          height *= maxWidth / width
          width = maxWidth
        }
      }
      else {
        if ( height > maxHeight ) {
          width *= maxHeight / height
          height = maxHeight
        }
      }
      canvas.width = width
      canvas.height = height
      context.drawImage(img, 0, 0, width, height)
      done(ret)
    }
    ret = {
      dataURL: function(){
        return canvas.toDataURL(sourceImage.type)
      },
      blob: function(){
        return localsys.datURLtoBlob(canvas.toDataURL(sourceImage.type), sourceImage.type)
      }
    }
    if( sourceImage instanceof Image ) {
      img = sourceImage
      resize()
    }
    else{
      if( typeof sourceImage == "string" ) {
        src = sourceImage
      }
      else if( sourceImage instanceof Blob ){
        urlSrc = win.URL.createObjectURL(sourceImage)
      }
      img.onload = resize
      img.src = src || urlSrc
      urlSrc && win.URL.revokeObjectURL(urlSrc)
    }
    return ret
  }

  /*
   * create a config for map readAs regexps
   * like
   * isImagePathXP = /.../
   * readThisAsBinary = /\.bin|\.blah|.../
   * textExtensions = ...
   * */
  localsys.smartRead = function( file, done ){
    if ( localsys.isImagePath(file.name) ) {
      localsys.readDataUrl(file, done)
    }
    else {
      localsys.readJSON(file, function( json ){
        done(json)
      }, function(){
        localsys.readText(file, function( text ){
          done(text)
        })
      })
    }
  }

  function dynamicSpace( bytes, precision ){
    precision = precision || 1
    return bytes > 1024*1024*1024*1024 ? ((bytes / 1024/1024/1024/1024)*precision>>0)/precision + "TB"
      : bytes > 1024*1024*1024 ? ((bytes / 1024/1024/1024)*precision>>0)/precision + "GB"
      : bytes > 1024*1024 ? ((bytes / 1024/1024)*precision>>0)/precision + "MB"
      : bytes > 1024 ? ((bytes / 1024)*precision>>0)/precision + "KB"
      : bytes + "b"
  }
  localsys.dynamicSpace = dynamicSpace

  function each( arr, f ){
    var i = -1, l = arr.length
    while( ++i<l ) f(arr[i], i, arr);
  }

  function extend( obj, extension ){
    for ( var prop in extension ) {
      obj[prop] = extension[prop]
    }
    return obj
  }

  function configure( options ){
    extend(globalConfig, options)
  }
  localsys.config = configure

  function LocalError( e, msg, extra, done, failed ){
    this.e = e || new Error()
    this.message = "Local File System "
    switch ( e.code ) {
      case QUOTA_EXCEEDED_ERR:
        this.message += 'Exceeded granted quota of ' + dynamicSpace(grantedBytes)
        break;
      case NOT_FOUND_ERR:
        this.message += 'Not found'
        break;
      case SECURITY_ERR:
        this.message += 'Security Error'
        break;
      case INVALID_MODIFICATION_ERR:
        this.message += 'Invalid Modification'
        break;
      case INVALID_STATE_ERR:
        this.message += 'Invalid State'
        break;
      default:
        this.message += 'Error';
        break;
    }
    this.message += " " + msg
    this.extra = extra
    globalConfig.logErrors && console.error("%O", this)
    failed ? failed(this) : done && done(null, this)
  }
  LocalError.prototype = new Error()
  LocalError.prototype.constructor = LocalError

  function askForMore( e, options, path, done, failed ){
    debugger;
    var requestSize = grantedBytes
      , configSize = globalConfig.requestQuotaSize || 0
      , errorObj = e.code ? e : (e.currentTarget || e.srcElement).error

    if ( !QUOTA_REQUEST_ERR && errorObj.code == QUOTA_EXCEEDED_ERR && configSize && !local.isTemporary ) {

      requestSize += options.content instanceof Blob && globalConfig.requestQuotaFileSize
        ? options.content.size
        : configSize

      storageInfo.requestQuota(win.PERSISTENT, requestSize, function( granted ){
          local.granted = grantedBytes = granted
          // since I guess creating a folder won't cause you this trouble
          // we call this only from processFile anyway
          getFile(options)
        },
        function( e ){
          QUOTA_REQUEST_ERR = true
          new LocalError(errorObj, "Error requesting quota", null, done, failed)
        }
      )
    }
    else new LocalError(errorObj, "Failed to write ", path, done, failed)
  }

  function filterEntries( entries, filter ){
    var ret = []
      , i = -1
      , l = entries.length
    if ( typeof filter == "function" ) {
      while ( ++i < l ) {
        filter(entries[i]) && ret.push(entries[i])
      }
    }
    else if ( filter instanceof RegExp ) {
      while ( ++i < l ) {
        filter.test(entries[i].name) && ret.push(entries[i])
      }
    }
    else if ( typeof filter == "string" ) {
      if ( filter == "file" ) {
        while ( ++i < l ) {
          entries[i].isFile && ret.push(entries[i])
        }
      }
      else if ( filter == "directory" ) {
        while ( ++i < l ) {
          entries[i].isFile || ret.push(entries[i])
        }
      }
      else {
        while ( ++i < l ) {
          ~entries[i].name.indexOf(filter) && ret.push(entries[i])
        }
      }
    }
    else return entries
    return ret
  }

  function moveCopyRename( op, root, options ){
    var entry = options.path
      , source = options.source
      , done = options.done

    function failed( e ){
      new LocalError(e, "Error renaming entry", options, done, options.error)
    }

    if ( !entry ) return failed()
    if ( typeof entry == "string" ) {
      return root[isFilePath(entry) ? "getFile" : "getDirectory"](entry, {}, function( entry ){
        options.path = entry
        moveCopyRename(op, root, options)
      }, failed)
    }
    if ( !source ) {
      source = localsys.parentPath(entry.fullPath)
    }
    if ( typeof source == "string" ) {
      return root.getDirectory(source, options, function( source ){
        options.source = source
        moveCopyRename(op, root, options)
      })
    }
    console.log("rename entry", entry)
    entry[op](source, options.rename, function( entry ){
      console.log("renamed entry", entry)
      options.done && options.done(entry)
    }, failed)
  }

  function isFilePath( path ){
    return /.+\.\w+$/.test(path)
  }

  function getDir( options ){
    var source = options.source || local.root
      , path = options.path
      , done = options.done
      , failed = options.error
      , dirs = []

    if ( !path ) return new LocalError(null, "No path specified", options, done, failed)

    /* resolve root */
    if ( typeof source == "string" ) {
      return local.root.getDirectory(source, options, function( dir ){
        options.source = dir
        getDir(options)
      }, function( e ){
        if ( options.create && options.resolve ) {
          path = path.replace(/^\/|\/$/g, "").split("/")
          return createDir(local.root, path, done, failed)
        }
        new LocalError(e, "Invalid path", path, done, failed)
      })
    }
    else if ( !(source instanceof local.root.constructor) ) {
      return new LocalError(null, "Invalid argument, root must be string or an instance of DirectoryEntry", source, done, failed)
    }

    /* path array */
    if ( typeof path != "string" && path.length || path.shift ) {
      function dirArray(){
        options.path = path.shift()
        options.done = function( dir ){
          dirs.push(dir)
          if ( path.length ) {
            dirArray()
          }
          else done(dirs)
        }
        getDir(options)
      }

      return dirArray()
    }
    if ( /filesystem:/.test(path) ) {
      return resolveLocalFileSystemURL(path, function( dir ){
        processDir(dir, path, source, options, done, failed)
      })
    }

    if ( path instanceof source.constructor ) {
      processDir(path, path.fullPath, options, done, failed)
    }
    else {
      source.getDirectory(path, options, function( dir ){
        processDir(dir, path, options, done, failed)
      }, function( e ){
        if ( options.create = options.create || options.resolve ) {
          path = path.replace(/^\/|\/$/g, "").split("/")
          return createDir(local.root, path, done, failed, options)
        }
        else new LocalError(e, "Invalid path", path, done, failed)
      })
    }
  }
  function processDir( dir, path, options, done, failed ){
    /* entry */
    if ( options.entry ) return done && done(dir)

    /* create */
    if ( options.create ) return done && done(dir)

    /* remove */
    if ( options.remove ) {
      dir[options.resolve ? "removeRecursively" : "remove"](done, function( e ){
        new LocalError(e, "Can't delete directory: ", path, done, failed)
      })
    }

    /* read */
    else readDir(dir, options)
  }
  function createDir( root, pathArray, done, failed, options ){
    while ( pathArray[0] == "" || pathArray[0] == "." ) {
      pathArray.shift()
    }

    root.getDirectory(pathArray[0], {create: true}, function( dir ){
      pathArray.shift()
      if ( pathArray.length ) {
        createDir(dir, pathArray, done, failed)
      }
      else if ( options && !options.create ) {
        getDir(options)
      }
      else done(dir)
    }, function( e ){
      new LocalError(e, "Failed to initialize " + pathArray[0], pathArray, done, failed)
    })
  }
  function readDir( dir, options ){
    var reader = dir.createReader()
      , entries = []
      , done = options.done
      , failed = options.error

    function read(){
      reader.readEntries(function( results ){
        if ( !results.length ) {
          if ( done ) {
            entries = filterEntries(entries, options.filter)
            if ( options.map ) {
              var map = {}
              for ( var i = -1, entry; entry = entries[++i]; ) {
                map[entry.fullPath] = entry
              }
              entries = map
            }
            done(entries)
          }
        }
        else {
          entries = entries.concat([].slice.call(results))
          read()
        }
      }, function( e ){
        LocalError(e, "Failed to read directory", dir, done, failed)
      })
    }

    read()
  }

  function getFile( options ){
    var source = options.source || local.root
      , path = options.path
      , done = options.done
      , failed = options.error
      , entries = []
      , content = options.content
      , i = -1, l = -1, c
       /* resolve root */
    if ( typeof source == "string" ) {
      options.path = source
      options.done = function( dir ){
        options.path = path
        options.source = dir
        options.done = done
        getFile(options)
      }
      return getDir(options)
    }
    else if ( !(source instanceof local.root.constructor) )
      return new LocalError(0, "Invalid argument, root must be string or an instance of DirectoryEntry", source, done, failed)

    if ( content && content.isFile )
      return processFile(content, path, options, done, failed)

    if ( !path )
      return new LocalError(0, "No path specified", options, done, failed)

    /* path array */
    if ( typeof path != "string" ) {
      if ( path.length && path.shift ) {
        options.path = path[0]
        options.done = function(){
          path.shift()
          if ( path.length ) {
            options.path = path[0]
            getFile(options)
          }
          else done && done()
        }
        getFile(options)
      }
      else {
        for ( var fileName in path ) {
          options.path = fileName
          options.content = path[fileName]
          getFile(options)
        }
      }
      return
    }
    if ( /filesystem:/.test(path) )
      return resolveLocalFileSystemURL(path, function( entry ){
        processFile(entry, path, options, done, failed)
      })

    /* resolve content */
    if ( options.create && options.content === undefined )
      return new LocalError(0, "Can't create file with undefined content", null, done, failed)


    if ( content && typeof content != "string" && !(content instanceof Blob) ) {
      /* get file array or FileList */
      if ( "length" in content ) {
        content = [].slice.call(content)
        function fileArray(){
          var name
          options.content = content.shift()
          name = options.rename
            ? options.rename(options.content.name) : options.content.name
          options.path = localsys.replacePath(name, path)
          options.done = function( entry ){
            entries.push(entry)
            if ( content.length ) {
              options.progress && options.progress(entry, ++i)
              fileArray()
            }
            else {
              options.progress && options.progress(entry, ++i)
              done(entries)
            }
          }
          getFile(options)
        }

        options.error = function( e ){
          ++i
          new LocalError(e, "multiple file operation failed", options.content, done, failed)
        }
        return fileArray()
      }
      else if( content instanceof ImageData ){
        options.content = localsys.imageDataToBlob(content)
        getFile(options)
      }
      /* file object where keys are file names and values are contents */
      else {
        entries = {}
        for ( c in content ) {
          ++l;
          (function( c ){
            options.content = content[c]
            options.path = localsys.replacePath(c, path)
            options.done = function( entry ){
              entries[c] = entry
              options.progress && options.progress(entry, c)
              if ( ++i == l ) {
                done(entries)
              }
            }
            options.error = function( e ){
              ++i
              new LocalError(e, "multiple file operation failed", content[c], done, failed)
            }
            getFile(options)
          }(content))
        }
      }
    }
    /* get file */
    else {
      source.getFile(path, options, function( entry ){
        processFile(entry, path, options, done, failed)
      }, function( e ){
        if( e.code == QUOTA_EXCEEDED_ERR ) return askForMore(e, options, path, done, failed)
        options.resolve = options.resolve || options.content != undefined
        options.create = options.create || options.resolve
        if ( options.create && options.resolve ) {
          path = path.replace(/^\/?(.*)\/.*?$/, "$1").split("/")
          createDir(local.root, path, function(){
            getFile(options)
          }, failed)
        }
        else new LocalError(e, "Failed to initialize ", path, done, failed)
      })
    }
  }
  function processFile( entry, path, options, done, failed ){

    if ( options.entry ) return done && done(entry)

    /* write */
    if ( options.create ) {
      options.truncate = options.truncate == undefined || options.truncate || !options.append
      entry.createWriter(function( writer ){
        writer.onwriteend = function(){
          if ( options.truncate ) {
            writer.onwriteend = function(){
              if( !done ) return
              if( options.read ) readFile(entry, options, done, failed)
              else done(entry)
            }
            options.append && writer.seek(options.seek == undefined ? writer.length : options.seek)
            if ( options.content instanceof Blob ) {
              writer.write(options.content)
            }
            else writer.write(new Blob([options.content], options))
          }
          else done && done(entry)
        }
        writer.onerror = function( e ){
          askForMore(e, options, path, done, failed)
        }
        if ( options.truncate ) writer.truncate(0)
        else {
          if( options.append ) writer.seek(writer.length)
          else if( options.seek ) writer.seek(options.seek)
          if ( options.content instanceof Blob ) {
            writer.write(options.content)
          }
          else writer.write(new Blob([options.content], options))
        }
      }, function( e ){
        new LocalError(e, "Failed to write ", path, done, failed)
      })
    }

    /* delete */
    else if ( options.remove ) {
      entry.remove(done, function( e ){
        new LocalError((e.currentTarget || e.srcElement).error, "Failed to write", path, done, failed)
      })
    }

    /* read */
    else readFile(entry, options, done, failed)
  }

  function readFile( entry, options, done, failed ){
    entry.file(function( file ){
      options.as == "binary" ? localsys.readBinary(file, done)
        : options.as == "data" ? localsys.readDataUrl(file, done)
        : options.as == "buffer" ? localsys.readBuffer(file, done)
        : options.as == "json" ? localsys.readJSON(file, done, failed)
        : options.as == "file" ? done(file)
        : (!options.as || options.as == "text") && localsys.readText(file, done)
    }, function( e ){
      new LocalError(e, "Failed to read", entry.fullPath, done, failed)
    })
  }

  function smartRead( fileEntry, options, done ){
    var name = fileEntry.name
      , extension = name.replace(/.+(\.\w+)$/, "$1")
    if ( localsys.isImagePath(name) ) return done(fileEntry.toURL())
    fileEntry.file(function( file ){
      if( options.extensions && options.extensions[extension] ){
        readFile(fileEntry, {as: options.extension[extension]}, done)
      }
      else if( /image*/.test(file.type) ){
        done(file.toURL())
      }
      else if( name.indexOf(".json") ){
        localsys.readJSON(file, done, done)
      }
      else {
        localsys.readText(file, done)
      }
    })
  }

  function LocalSys( fs, type, isTemp, granted ){
    this.native = fs
    this.root = fs.root
    this.type = type
    this.isTemporary = isTemp
    this.granted = granted
  }
  LocalSys.prototype = {
    config: function( options ){
      configure(options)
    },
    storageUsageInfo: function( options ){
      options = options || {}
      var precision = options.precision || 1
        , failed = options.error
        , done = options.done
      storageInfo.queryUsageAndQuota(this.type, function( used, remaining ){
        used = dynamicSpace(used, precision)
        remaining = dynamicSpace(remaining, precision)
        console.log("used: %s, remaining: %s", used, remaining)
        options.done && options.done(used, remaining)
      }, function( e ){
        new LocalError(e, "Couldn't fetch local storage info", done, failed)
      })
    },
    exists: function( path, done ){
      var fileOrDir = isFilePath(path) ? getFile : getDir
      fileOrDir({
        path: path,
        done: function( result, e ){
          console.log(!e ? "exists" : "does not exists", path)
          done(!e)
        }
      })
    },
    tree: function( options ){
      options = options || {
        path: this.root,
        done: function( tree ){
          console.log(tree)
        }
      }
      var done = options.done
        , bubble = options.bubble || done
        , tree = options.tree || {}
        , read = options.read
        , length
        , files = 0, dirs = 0
        , f = 0, d = 0

      if( !options.root ){
        options.root = tree
      }

      function dig( entries ){
        each(entries, function( entry ){
          if( entry.isFile ) return
          ++dirs
          options.tree = tree[entry.name] = {}
          options.path = entry
          options.bubble = function(  ){
            if( ++d == dirs ){
              bubble(options.root)
            }
          }
          local.tree(options)
        })
        if( !dirs ) bubble(options.root)
      }

      options.done = function( entries ){
        length = entries.length
        options.done = done
        if( !length ) bubble(options.root)
        each(entries, function( entry ){
          var name = options.extension ? entry.name : localsys.stripExtension(entry.name)
          if( entry.isFile ){
            ++files
            if( read ){
              smartRead(entry, options, function( content ){
                tree[name] = content
                if( ++f == files ) dig(entries)
              })
            }
            else {
              tree[name] = entry
            }
          }
        })
        ;(!read || !files) && dig(entries)
      }
      getDir(options)
    },
    move: function( options ){
      moveCopyRename("moveTo", options.source || this.root, options)
    },
    copy: function( options ){
      moveCopyRename("copyTo", options.source || this.root, options)
    },
    rename: function( options ){
      moveCopyRename("moveTo", options.source || this.root, options)
    },
    createDir: function( options ){
      options.create = true
      options.resolve = options.resolve == undefined || options.resolve
      getDir(options)
    },
    write: function( options ){
      options.create = true
      options.resolve = options.resolve == undefined || options.content != undefined
      getFile(options)
    },
    read: function( options ){
      options.read = true
      if ( options.content || isFilePath(options.path) ) getFile(options)
      else getDir(options)
    },
    remove: function( options ){
      options.resolve = options.resolve == undefined || options.resolve
      options.remove = true
      !options.path || isFilePath(options.path) ? getFile(options) : getDir(options)
    }
  }

  /* request temp file system */
  function initTemp( options, done, failed ){
    request(TEMPORARY, options.size, function( fs ){
      local = new LocalSys(fs, TEMPORARY, true)
      delete options.done
      delete options.error
      globalConfig = options
      done && done(local)
    }, function( e ){
      new LocalError(e, "Failed to initialize file system", done, failed)
    })
  }

  /* request persistent file system */
  function initPersistent( options, done, failed ){
    window.webkitStorageInfo.requestQuota(
      PERSISTENT, options.size, function( granted ){
        request(PERSISTENT, granted,
          function( fs ){
            local = new LocalSys(fs, PERSISTENT, false, granted)
            baseQuota = grantedBytes = granted
            delete options.done
            delete options.error
            globalConfig = options
            done && done(local)
          }, function( e ){
            new LocalError(e, "Failed to initialize file system", done, failed)
          })
      }, function( e ){
        new LocalError(e, "Failed to initialize file system", done, failed)
      })
  }

  /* request local file system
   * set temp to to true if you don't want it to be persistent
   * there's no default size, so size is not optional
   * but the callbacks are (for some strange reason)
   * {
   *   temp: true | false
   *   size: Number,
   *   done: function,
   *   error: function
   * }
   * */
  localsys.request = function( options ){
    if ( !local ) {
      options.temp
        ? initTemp(options, options.done, options.error)
        : initPersistent(options, options.done, options.error)
    }
    else options.done(local)
  }

  host.localsys = localsys
}(window, document, this);