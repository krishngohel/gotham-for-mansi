import * as THREE from 'three';

function boneIndex(mesh, name) {
  const i = mesh.skeleton.bones.findIndex((b) => b.name === name);
  if (i < 0) throw new Error(`No bone named ${name}`);
  return i;
}

// Bone origin in the mesh's bind space, valid in any current pose.
export function bindPosition(mesh, name) {
  const inv = mesh.skeleton.boneInverses[boneIndex(mesh, name)];
  return new THREE.Vector3().setFromMatrixPosition(inv.clone().invert()).applyMatrix4(mesh.bindMatrixInverse);
}

// Parent an object placed in bind space to a bone so it follows the animation rigidly.
export function attachRigid(mesh, name, object) {
  const i = boneIndex(mesh, name);
  object.updateMatrix();
  object.matrix.premultiply(mesh.bindMatrix).premultiply(mesh.skeleton.boneInverses[i]);
  object.matrix.decompose(object.position, object.quaternion, object.scale);
  mesh.skeleton.bones[i].add(object);
  return object;
}

// Frontmost body surface (bind space) along the center line at height y.
export function surfaceFrontZ(body, y, fwd) {
  const pos = body.geometry.attributes.position;
  const v = new THREE.Vector3();
  let front = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (Math.abs(v.x) < 0.03 && Math.abs(v.y - y) < 0.03) front = Math.max(front, v.z * fwd);
  }
  return front * fwd;
}

export function measureBody(body, eyes) {
  const bp = (n) => bindPosition(body, n);
  const pos = body.geometry.attributes.position;
  const head = bp('Head');
  const headBox = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > head.y && Math.abs(v.x) < 0.15) headBox.expandByPoint(v);
  }
  const headCenter = headBox.getCenter(new THREE.Vector3());
  const headSize = headBox.getSize(new THREE.Vector3());
  eyes.geometry.computeBoundingBox();
  const eyeBox = eyes.geometry.boundingBox;
  const eye = eyeBox.getCenter(new THREE.Vector3());
  const eyeSize = eyeBox.getSize(new THREE.Vector3());
  const fwd = Math.sign(eye.z - headCenter.z) || 1;
  const chestY = bp('spine_03').y + 0.06;
  return {
    fwd,
    neckY: bp('neck_01').y,
    headCenter,
    headRadius: Math.max(headSize.x, headSize.z) / 2,
    headTop: headBox.max.y,
    eyeY: eye.y,
    eyeSpread: eyeSize.x / 2 - eyeSize.y / 2,
    eyeFrontZ: fwd > 0 ? eyeBox.max.z : eyeBox.min.z,
    shoulderX: Math.abs(bp('upperarm_l').x),
    elbowX: Math.abs(bp('lowerarm_l').x) + 0.04,
    kneeY: bp('calf_l').y,
    ankleY: bp('foot_l').y,
    beltY: bp('pelvis').y + 0.09,
    hipHalfWidth: Math.abs(bp('thigh_l').x) + 0.12,
    chestY,
    chestFrontZ: surfaceFrontZ(body, chestY, fwd),
  };
}
