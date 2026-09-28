// Node-side loader for the hero rigs and animation packs: strips textures (no DOM image
// decoding in node) and hands the GLBs to three's GLTFLoader.parse. Used by the pose tools
// and the kick unit test.
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const loader = new GLTFLoader();

export async function loadGlb(path, { stripTextures = true } = {}) {
  let buffer = readFileSync(path).buffer;
  if (stripTextures) {
    const doc = await io.readBinary(new Uint8Array(readFileSync(path)));
    for (const mat of doc.getRoot().listMaterials()) {
      mat.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    }
    for (const tex of doc.getRoot().listTextures()) tex.dispose();
    const out = await io.writeBinary(doc);
    buffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  return new Promise((res, rej) => loader.parse(buffer, '', res, rej));
}
