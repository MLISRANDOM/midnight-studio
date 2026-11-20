const deviceCheck=window.parent!==window && new URLSearchParams(location.search).get("device-check")==="1";
const dbName=deviceCheck?"midnight-motion-verification-v1":"midnight-motion-lab-v1",store="items";
export async function stored(key,value) {
  const db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open(dbName,1);
    r.onupgradeneeded=()=>r.result.createObjectStore(store);
    r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);
  });
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(store,value===undefined?"readonly":"readwrite");
      const obj=tx.objectStore(store),r=value===undefined?obj.get(key):obj.put(value,key);
      tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  } finally {db.close();}
}
