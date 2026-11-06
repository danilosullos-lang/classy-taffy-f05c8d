import "./style.css";
import { Engine, Scene, Vector3, HemisphericLight, DirectionalLight, MeshBuilder, StandardMaterial, Color3, FollowCamera, type AbstractMesh } from "@babylonjs/core";
import "@babylonjs/loaders";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const status = document.querySelector<HTMLElement>("#status");
const joystick = document.querySelector<HTMLElement>("#joystick");
const stick = document.querySelector<HTMLElement>("#stick");
if (!canvas || !status || !joystick || !stick) throw new Error("Aetheria: elementos essenciais da interface não encontrados.");

const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true });
const scene = new Scene(engine);
scene.clearColor.set(0.035, 0.055, 0.075, 1);
scene.collisionsEnabled = true;
scene.gravity = new Vector3(0, -0.32, 0);

new HemisphericLight("ambient", new Vector3(0, 1, 0), scene).intensity = 0.78;
const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.35), scene);
sun.position = new Vector3(20, 35, -20);
sun.intensity = 1.1;

const ground = MeshBuilder.CreateGround("world-ground", { width: 160, height: 160, subdivisions: 2 }, scene);
ground.checkCollisions = true;
const groundMat = new StandardMaterial("ground-material", scene);
groundMat.diffuseColor = new Color3(0.16, 0.23, 0.19);
groundMat.specularColor = Color3.Black();
ground.material = groundMat;

const player = MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.42, tessellation: 12 }, scene);
player.position = new Vector3(0, 0.92, 0);
player.ellipsoid = new Vector3(0.42, 0.9, 0.42);
player.ellipsoidOffset = new Vector3(0, 0.9, 0);
player.checkCollisions = true;
const playerMat = new StandardMaterial("player-material", scene);
playerMat.diffuseColor = new Color3(0.72, 0.55, 0.32);
playerMat.specularColor = new Color3(0.15, 0.15, 0.15);
player.material = playerMat;

const camera = new FollowCamera("third-person-camera", new Vector3(0, 4, -9), scene);
camera.lockedTarget = player;
camera.radius = 8;
camera.heightOffset = 3.1;
camera.rotationOffset = 180;
camera.cameraAcceleration = 0.06;
camera.maxCameraSpeed = 12;
camera.lowerRadiusLimit = 4;
camera.upperRadiusLimit = 13;
camera.attachControl(canvas, true);
camera.inputs.removeByType("FollowCameraKeyboardMoveInput");
camera.checkCollisions = true;
camera.collisionRadius = new Vector3(0.35, 0.35, 0.35);

const keys = new Set<string>();
const keyDown = (event: KeyboardEvent) => keys.add(event.key.toLowerCase());
const keyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
window.addEventListener("keydown", keyDown);
window.addEventListener("keyup", keyUp);
window.addEventListener("blur", () => keys.clear());

let stickX = 0;
let stickY = 0;
let activePointer: number | null = null;
const resetStick = () => {
  stickX = 0; stickY = 0;
  stick.style.transform = "translate(0px, 0px)";
  activePointer = null;
};
joystick.addEventListener("pointerdown", (event) => {
  activePointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  moveStick(event);
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === activePointer) moveStick(event);
});
joystick.addEventListener("pointerup", resetStick);
joystick.addEventListener("pointercancel", resetStick);
function moveStick(event: PointerEvent) {
  const rect = joystick.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const max = 34;
  const length = Math.hypot(dx, dy) || 1;
  const scale = Math.min(1, max / length);
  const x = dx * scale, y = dy * scale;
  stickX = x / max;
  stickY = y / max;
  stick.style.transform = `translate(${x}px, ${y}px)`;
}

let verticalVelocity = 0;
const movementSpeed = 5.2;
scene.onBeforeRenderObservable.add(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
  const forwardInput = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - stickY;
  const sideInput = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + stickX;
  const input = new Vector3(sideInput, 0, forwardInput);
  if (input.lengthSquared() > 1) input.normalize();

  const yaw = camera.rotation.y;
  const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new Vector3(forward.z, 0, -forward.x);
  const direction = right.scale(input.x).add(forward.scale(input.z));
  if (direction.lengthSquared() > 0.0001) {
    direction.normalize();
    player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  verticalVelocity += scene.gravity.y * dt;
  const velocity = direction.scale(movementSpeed * dt);
  velocity.y = verticalVelocity * dt;
  player.moveWithCollisions(velocity);
  if (player.position.y <= 0.92) {
    player.position.y = 0.92;
    verticalVelocity = 0;
  }
});
status.textContent = "Mundo 3D carregado · protótipo do Módulo 1";
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
window.addEventListener("pagehide", () => {
  window.removeEventListener("keydown", keyDown);
  window.removeEventListener("keyup", keyUp);
  engine.stopRenderLoop();
  engine.dispose();
});
